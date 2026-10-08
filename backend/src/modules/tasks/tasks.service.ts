import { Difficulty, Prisma, TaskPriority, TaskStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  authorizeProject,
  garantirExclusaoDeTarefa,
  resolveProjectContext,
} from "../../authorization/authorize.js";
import {
  projetosAtivosVisiveis,
  tarefasVisiveis,
} from "../../authorization/scopes.js";
import { registrarAtividade } from "../../lib/activity-log.js";
import { conflito, naoEncontrado, regraDeNegocio } from "../../lib/errors.js";
import { dataPura, hojeNoFuso } from "../../lib/datas.js";
import { prisma, type PrismaTx } from "../../lib/prisma.js";
import { nomeDoAutor, notificarVarios } from "../notifications/notifications.service.js";
import { obterCaixaDeEntrada } from "../projects/inbox.js";

/**
 * Tarefas e subtarefas.
 *
 * Toda tarefa pertence a um projeto e herda dele o acesso: quem enxerga o
 * projeto enxerga suas tarefas, no mesmo papel. Não há permissão por tarefa.
 */

/** Status que representam trabalho ativo, usados nas listas e no "atrasada". */
const STATUS_ATIVOS: TaskStatus[] = [
  TaskStatus.A_FAZER,
  TaskStatus.EM_ANDAMENTO,
  TaskStatus.EM_REVISAO,
];

/** Espaçamento entre posições, para caber inserções sem reordenar a coluna. */
const PASSO_DE_POSICAO = 1000;

const selecaoDaTarefa = {
  id: true,
  projectId: true,
  parentId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  difficulty: true,
  dueDate: true,
  position: true,
  completedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, image: true } },
  updatedBy: { select: { id: true, name: true, image: true } },
  assignees: {
    select: {
      user: { select: { id: true, name: true, image: true } },
    },
  },
  _count: { select: { subtasks: { where: { deletedAt: null } } } },
} as const;

// --- Leitura ---------------------------------------------------------------

export async function listarTarefasDoProjeto(
  userId: string,
  projectId: string,
  filtros: { status?: TaskStatus; incluirSubtarefas?: boolean } = {},
) {
  await authorizeProject(userId, projectId, "projeto.ver");

  return prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
      // No Kanban e nas listas, subtarefas aparecem dentro do cartão do pai,
      // e não como cartões soltos.
      ...(filtros.incluirSubtarefas ? {} : { parentId: null }),
      ...(filtros.status && { status: filtros.status }),
    },
    select: selecaoDaTarefa,
    orderBy: [{ status: "asc" }, { position: "asc" }],
  });
}

export async function obterTarefa(userId: string, taskId: string) {
  const tarefa = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: {
      ...selecaoDaTarefa,
      subtasks: {
        where: { deletedAt: null },
        select: selecaoDaTarefa,
        orderBy: { position: "asc" },
      },
      parent: { select: { id: true, title: true } },
    },
  });
  // Sem tarefa, ou sem acesso ao projeto dela, a resposta é a mesma: um
  // projeto invisível não pode ser revelado pela existência de suas tarefas.
  if (!tarefa) throw naoEncontrado("Tarefa");

  await authorizeProject(userId, tarefa.projectId, "projeto.ver");
  return tarefa;
}

// --- Listas da barra lateral ----------------------------------------------

/**
 * "Vencem Hoje": só tarefas em que sou responsável, vencendo no meu dia atual.
 * Backlog e Em pausa ficam de fora — não são trabalho ativo — e concluídas
 * também.
 */
export async function vencemHoje(userId: string, timezone: string, limite = 15) {
  const hoje = dataPura(hojeNoFuso(timezone));

  return prisma.task.findMany({
    where: {
      ...tarefasVisiveis(userId),
      assignees: { some: { userId } },
      dueDate: hoje,
      status: { in: STATUS_ATIVOS },
    },
    select: selecaoDaTarefa,
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    take: limite,
  });
}

/**
 * "Vencidas": tarefas minhas com prazo já passado, mesmo critério de trabalho
 * ativo de "Vencem Hoje" (Backlog e Em pausa ficam de fora, concluídas também).
 */
export async function vencidas(userId: string, timezone: string, limite = 15) {
  const hoje = dataPura(hojeNoFuso(timezone));

  return prisma.task.findMany({
    where: {
      ...tarefasVisiveis(userId),
      assignees: { some: { userId } },
      dueDate: { lt: hoje },
      status: { in: STATUS_ATIVOS },
    },
    select: selecaoDaTarefa,
    orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
    take: limite,
  });
}

/**
 * Seções de prioridade: tarefas minhas que não estão concluídas — as
 * atribuídas a mim e tudo o que está na minha Caixa de entrada, o mesmo
 * critério de `todasAsTarefas`.
 * Diferente de "Vencem Hoje", aqui Backlog e Em pausa entram: o usuário
 * classificou a prioridade e quer continuar vendo o item.
 */
export async function porPrioridade(
  userId: string,
  priority: TaskPriority,
  limite = 15,
) {
  const where: Prisma.TaskWhereInput = {
    ...tarefasVisiveis(userId),
    OR: [
      { assignees: { some: { userId } } },
      { project: { isInbox: true, ownerId: userId } },
    ],
    priority,
    status: { not: TaskStatus.CONCLUIDO },
  };

  const [itens, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: selecaoDaTarefa,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
      take: limite,
    }),
    prisma.task.count({ where }),
  ]);

  return { itens, total };
}

/**
 * Todas as tarefas minhas (sem paginação), para a página "Todas as tarefas":
 * as atribuídas a mim em qualquer projeto e, além delas, tudo o que está na
 * minha Caixa de entrada — lá a tarefa costuma nascer sem responsável, e é
 * minha por definição. Um teto de segurança evita um payload sem limite.
 */
const TETO_TODAS_AS_TAREFAS = 500;

export async function todasAsTarefas(
  userId: string,
  filtros: { projectId?: string } = {},
) {
  return prisma.task.findMany({
    where: {
      ...tarefasVisiveis(userId),
      OR: [
        { assignees: { some: { userId } } },
        { project: { isInbox: true, ownerId: userId } },
      ],
      parentId: null,
      ...(filtros.projectId && { projectId: filtros.projectId }),
    },
    select: selecaoDaTarefa,
    orderBy: [{ status: "asc" }, { position: "asc" }],
    take: TETO_TODAS_AS_TAREFAS,
  });
}

/**
 * "Recentes": as 5 tarefas modificadas por último nos projetos que acesso,
 * por qualquer pessoa — e não só por mim. Mostra quem alterou.
 */
export async function recentes(userId: string, limite = 5) {
  const registros = await prisma.activityLog.findMany({
    where: {
      entityType: "TAREFA",
      // O filtro roda no banco: o histórico de um projeto invisível nunca
      // chega a ser lido.
      project: projetosAtivosVisiveis(userId),
    },
    orderBy: { createdAt: "desc" },
    // Uma tarefa editada cinco vezes ocuparia a lista inteira; buscamos mais
    // registros e reduzimos a uma linha por tarefa.
    take: limite * 8,
    select: {
      entityId: true,
      action: true,
      createdAt: true,
      actor: { select: { id: true, name: true, image: true } },
    },
  });

  const vistas = new Set<string>();
  const maisRecentePorTarefa = registros.filter((r) => {
    if (vistas.has(r.entityId)) return false;
    vistas.add(r.entityId);
    return true;
  });

  const tarefas = await prisma.task.findMany({
    where: {
      id: { in: maisRecentePorTarefa.map((r) => r.entityId) },
      deletedAt: null,
    },
    select: selecaoDaTarefa,
  });

  const porId = new Map(tarefas.map((t) => [t.id, t]));

  return maisRecentePorTarefa
    .filter((r) => porId.has(r.entityId))
    .slice(0, limite)
    .map((r) => ({
      tarefa: porId.get(r.entityId)!,
      alteradoPor: r.actor,
      alteradoEm: r.createdAt,
      acao: r.action,
    }));
}

// --- Escrita ---------------------------------------------------------------

interface NovaTarefa {
  projectId?: string | null;
  parentId?: string | null;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  difficulty?: Difficulty | null;
  dueDate?: string | null;
  assigneeIds?: string[];
}

export async function criarTarefa(userId: string, dados: NovaTarefa) {
  // Sem projeto informado, a tarefa vai para a Caixa de entrada: é o que
  // permite o "+" da barra lateral criar algo sem escolher projeto.
  const projectId =
    dados.projectId ?? (await obterCaixaDeEntrada(userId)).id;

  const ctx = await authorizeProject(userId, projectId, "tarefa.criar");

  if (dados.parentId) {
    await validarPai(dados.parentId, projectId);
  }

  const status = dados.status ?? TaskStatus.A_FAZER;
  // Sem responsável escolhido, a tarefa fica com quem a criou: senão ela não
  // apareceria nas listas pessoais (prioridades, Vencem Hoje). Quem cria
  // passou por `authorizeProject`, logo já é membro do projeto.
  const escolhidos = [...new Set(dados.assigneeIds ?? [])];
  const responsaveis = escolhidos.length > 0 ? escolhidos : [userId];

  await garantirQueSaoMembros(projectId, responsaveis);

  const tarefa = await prisma.$transaction(async (tx) => {
    const position = await proximaPosicao(tx, projectId, status, dados.parentId);

    const criada = await tx.task.create({
      data: {
        projectId,
        parentId: dados.parentId ?? null,
        title: dados.title,
        description: dados.description ?? null,
        status,
        priority: dados.priority ?? TaskPriority.MEDIA,
        difficulty: dados.difficulty ?? null,
        dueDate: dados.dueDate ? dataPura(dados.dueDate) : null,
        position,
        completedAt: status === TaskStatus.CONCLUIDO ? new Date() : null,
        createdById: userId,
        updatedById: userId,
        assignees: { create: responsaveis.map((id) => ({ userId: id })) },
      },
      select: selecaoDaTarefa,
    });

    await registrarAtividade(
      {
        entityType: "TAREFA",
        entityId: criada.id,
        projectId,
        actorId: userId,
        action: "CRIADO",
        after: { title: criada.title, status: criada.status },
      },
      tx,
    );

    return criada;
  });

  await notificarAtribuicao(tarefa.id, tarefa.title, ctx.project.name, responsaveis, userId);
  return tarefa;
}

interface EdicaoDeTarefa {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  difficulty?: Difficulty | null;
  dueDate?: string | null;
  status?: TaskStatus;
  /** Versão lida pelo cliente. Divergência significa que outra pessoa alterou. */
  version: number;
  /** Confirma a conclusão do pai mesmo havendo subtarefas abertas. */
  concluirComSubtarefasAbertas?: boolean;
}

export async function atualizarTarefa(
  userId: string,
  taskId: string,
  dados: EdicaoDeTarefa,
) {
  const atual = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
  });
  if (!atual) throw naoEncontrado("Tarefa");

  await authorizeProject(userId, atual.projectId, "tarefa.editar");

  const vaiConcluir =
    dados.status === TaskStatus.CONCLUIDO && atual.status !== TaskStatus.CONCLUIDO;

  if (vaiConcluir && !dados.concluirComSubtarefasAbertas) {
    const abertas = await prisma.task.count({
      where: {
        parentId: taskId,
        deletedAt: null,
        status: { not: TaskStatus.CONCLUIDO },
      },
    });
    if (abertas > 0) {
      // Nada é concluído em cascata por conta própria: quem decide é o usuário.
      throw regraDeNegocio(
        abertas === 1
          ? "Esta tarefa tem 1 subtarefa aberta. Confirme para concluir mesmo assim."
          : `Esta tarefa tem ${abertas} subtarefas abertas. Confirme para concluir mesmo assim.`,
        { subtarefasAbertas: abertas },
      );
    }
  }

  const mudouStatus = dados.status !== undefined && dados.status !== atual.status;

  // "Unchecked" porque `updatedById` é a chave estrangeira crua: o tipo
  // verificado só aceita a relação, que `updateMany` não suporta.
  const dadosDeEscrita: Prisma.TaskUncheckedUpdateManyInput = {
    ...(dados.title !== undefined && { title: dados.title }),
    ...(dados.description !== undefined && { description: dados.description }),
    ...(dados.priority !== undefined && { priority: dados.priority }),
    ...(dados.difficulty !== undefined && { difficulty: dados.difficulty }),
    ...(dados.dueDate !== undefined && {
      dueDate: dados.dueDate ? dataPura(dados.dueDate) : null,
    }),
    ...(dados.status !== undefined && { status: dados.status }),
    // A data de conclusão é preenchida ao entrar em CONCLUIDO e limpa ao sair,
    // porque é ela que alimenta o gráfico de concluídas por semana.
    ...(mudouStatus && {
      completedAt: dados.status === TaskStatus.CONCLUIDO ? new Date() : null,
    }),
    updatedById: userId,
    version: { increment: 1 },
  };

  // A condição pela versão lida é o que impede sobrescrever, em silêncio, a
  // alteração feita por outra pessoa entre a leitura e a gravação.
  const { count } = await prisma.task.updateMany({
    where: { id: taskId, version: dados.version, deletedAt: null },
    data: dadosDeEscrita,
  });

  if (count === 0) {
    const quem = atual.updatedById
      ? await prisma.user.findUnique({
          where: { id: atual.updatedById },
          select: { name: true },
        })
      : null;
    throw conflito(
      quem
        ? `Esta tarefa foi alterada por ${quem.name}. Recarregue para ver a versão atual.`
        : "Esta tarefa foi alterada por outra pessoa. Recarregue para ver a versão atual.",
      { versaoAtual: atual.version },
    );
  }

  await registrarAtividade({
    entityType: "TAREFA",
    entityId: taskId,
    projectId: atual.projectId,
    actorId: userId,
    action: mudouStatus ? "STATUS_ALTERADO" : "ATUALIZADO",
    before: {
      title: atual.title,
      status: atual.status,
      priority: atual.priority,
      difficulty: atual.difficulty,
    },
    after: {
      title: dados.title ?? atual.title,
      status: dados.status ?? atual.status,
      priority: dados.priority ?? atual.priority,
      difficulty: dados.difficulty !== undefined ? dados.difficulty : atual.difficulty,
    },
  });

  return prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: selecaoDaTarefa,
  });
}

/**
 * Move a tarefa entre colunas do Kanban e dentro da coluna.
 *
 * A posição é calculada no servidor, a partir de "antes de qual tarefa": o
 * cliente descreve a intenção, e não o número. Isso evita que dois arrastos
 * simultâneos gravem a mesma posição.
 */
export async function moverTarefa(
  userId: string,
  taskId: string,
  destino: { status: TaskStatus; antesDeId?: string | null },
) {
  const atual = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
  });
  if (!atual) throw naoEncontrado("Tarefa");

  await authorizeProject(userId, atual.projectId, "tarefa.editar");

  const mudouStatus = destino.status !== atual.status;

  const atualizada = await prisma.$transaction(async (tx) => {
    const position = await posicaoAntesDe(
      tx,
      atual.projectId,
      destino.status,
      atual.parentId,
      destino.antesDeId ?? null,
      taskId,
    );

    const resultado = await tx.task.update({
      where: { id: taskId },
      data: {
        status: destino.status,
        position,
        updatedById: userId,
        version: { increment: 1 },
        ...(mudouStatus && {
          completedAt:
            destino.status === TaskStatus.CONCLUIDO ? new Date() : null,
        }),
      },
      select: selecaoDaTarefa,
    });

    if (mudouStatus) {
      await registrarAtividade(
        {
          entityType: "TAREFA",
          entityId: taskId,
          projectId: atual.projectId,
          actorId: userId,
          action: "STATUS_ALTERADO",
          before: { status: atual.status },
          after: { status: destino.status },
        },
        tx,
      );
    }

    return resultado;
  });

  return atualizada;
}

export async function definirResponsaveis(
  userId: string,
  taskId: string,
  assigneeIds: string[],
) {
  const tarefa = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    include: { assignees: { select: { userId: true } }, project: { select: { name: true } } },
  });
  if (!tarefa) throw naoEncontrado("Tarefa");

  await authorizeProject(userId, tarefa.projectId, "tarefa.editar");

  const desejados = [...new Set(assigneeIds)];
  await garantirQueSaoMembros(tarefa.projectId, desejados);

  const atuais = new Set(tarefa.assignees.map((a) => a.userId));
  const novos = desejados.filter((id) => !atuais.has(id));
  const removidos = [...atuais].filter((id) => !desejados.includes(id));

  if (novos.length === 0 && removidos.length === 0) return;

  await prisma.$transaction(async (tx) => {
    if (removidos.length > 0) {
      await tx.taskAssignee.deleteMany({
        where: { taskId, userId: { in: removidos } },
      });
    }
    if (novos.length > 0) {
      await tx.taskAssignee.createMany({
        data: novos.map((id) => ({ taskId, userId: id })),
      });
    }

    await registrarAtividade(
      {
        entityType: "TAREFA",
        entityId: taskId,
        projectId: tarefa.projectId,
        actorId: userId,
        action: novos.length > 0 ? "RESPONSAVEL_ATRIBUIDO" : "RESPONSAVEL_REMOVIDO",
        before: { responsaveis: [...atuais] },
        after: { responsaveis: desejados },
      },
      tx,
    );
  });

  await notificarAtribuicao(taskId, tarefa.title, tarefa.project.name, novos, userId);
  await notificarDesatribuicao(taskId, tarefa.title, tarefa.project.name, removidos, userId);
}

/**
 * Envia a tarefa para a Lixeira, junto com suas subtarefas.
 *
 * O lote (`deletionBatchId`) registra o que saiu nesta operação, para que a
 * restauração devolva exatamente isso.
 */
export async function excluirTarefa(userId: string, taskId: string) {
  const tarefa = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
  });
  if (!tarefa) throw naoEncontrado("Tarefa");

  const ctx = await resolveProjectContext(userId, tarefa.projectId);
  if (!ctx) throw naoEncontrado("Tarefa");
  garantirExclusaoDeTarefa(ctx, tarefa, userId);

  const agora = new Date();
  const lote = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: {
        deletedAt: null,
        OR: [{ id: taskId }, { parentId: taskId }],
      },
      data: { deletedAt: agora, deletedBy: userId, deletionBatchId: lote },
    });

    await registrarAtividade(
      {
        entityType: "TAREFA",
        entityId: taskId,
        projectId: tarefa.projectId,
        actorId: userId,
        action: "EXCLUIDO",
        before: { title: tarefa.title },
        after: { deletionBatchId: lote },
      },
      tx,
    );
  });

  return { deletionBatchId: lote };
}

// --- Apoio -----------------------------------------------------------------

/** Subtarefa tem um nível só e mora no mesmo projeto do pai. */
async function validarPai(parentId: string, projectId: string): Promise<void> {
  const pai = await prisma.task.findFirst({
    where: { id: parentId, deletedAt: null },
    select: { id: true, projectId: true, parentId: true },
  });
  if (!pai) throw naoEncontrado("Tarefa principal");

  if (pai.projectId !== projectId) {
    throw regraDeNegocio("A subtarefa precisa pertencer ao mesmo projeto do pai.");
  }
  if (pai.parentId) {
    throw regraDeNegocio("Subtarefas têm um nível só: não é possível aninhar mais.");
  }
}

/** Responsável precisa participar do projeto, senão teria tarefa sem acesso. */
async function garantirQueSaoMembros(
  projectId: string,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return;

  const membros = await prisma.projectMember.findMany({
    where: { projectId, userId: { in: userIds } },
    select: { userId: true },
  });

  if (membros.length !== userIds.length) {
    throw regraDeNegocio(
      "Só quem participa do projeto pode ser responsável por suas tarefas.",
    );
  }
}

async function proximaPosicao(
  db: PrismaTx,
  projectId: string,
  status: TaskStatus,
  parentId: string | null | undefined,
): Promise<number> {
  const ultima = await db.task.findFirst({
    where: { projectId, status, parentId: parentId ?? null, deletedAt: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (ultima?.position ?? 0) + PASSO_DE_POSICAO;
}

/**
 * Posição para inserir antes de uma tarefa — ou no fim, se `antesDeId` for nulo.
 * O ponto médio entre as vizinhas mantém a ordem sem reescrever a coluna toda.
 */
async function posicaoAntesDe(
  db: PrismaTx,
  projectId: string,
  status: TaskStatus,
  parentId: string | null,
  antesDeId: string | null,
  ignorarId: string,
): Promise<number> {
  const coluna = await db.task.findMany({
    where: {
      projectId,
      status,
      parentId,
      deletedAt: null,
      id: { not: ignorarId },
    },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });

  if (!antesDeId) {
    const ultima = coluna.at(-1);
    return (ultima?.position ?? 0) + PASSO_DE_POSICAO;
  }

  const indice = coluna.findIndex((t) => t.id === antesDeId);
  if (indice === -1) {
    // A referência saiu da coluna (outra pessoa moveu, ou foi excluída):
    // colocar no fim é mais previsível do que falhar o arrasto.
    const ultima = coluna.at(-1);
    return (ultima?.position ?? 0) + PASSO_DE_POSICAO;
  }

  const seguinte = coluna[indice]!;
  const anterior = coluna[indice - 1];
  if (!anterior) return seguinte.position - PASSO_DE_POSICAO;

  return (anterior.position + seguinte.position) / 2;
}

async function notificarAtribuicao(
  taskId: string,
  titulo: string,
  nomeDoProjeto: string,
  responsaveis: string[],
  autorId: string,
): Promise<void> {
  if (responsaveis.length === 0) return;

  await notificarVarios(
    responsaveis,
    {
      type: "TAREFA_ATRIBUIDA",
      payload: {
        taskId,
        taskTitle: titulo,
        projectName: nomeDoProjeto,
        autorNome: await nomeDoAutor(autorId),
      },
    },
    // Quem se atribui não precisa ser avisado do próprio ato.
    autorId,
  );
}

/** Avisa quem deixou de ser responsável — salvo quem se tirou sozinho. */
async function notificarDesatribuicao(
  taskId: string,
  titulo: string,
  nomeDoProjeto: string,
  removidos: string[],
  autorId: string,
): Promise<void> {
  if (removidos.length === 0) return;

  await notificarVarios(
    removidos,
    {
      type: "TAREFA_DESATRIBUIDA",
      payload: {
        taskId,
        taskTitle: titulo,
        projectName: nomeDoProjeto,
        autorNome: await nomeDoAutor(autorId),
      },
    },
    autorId,
  );
}
