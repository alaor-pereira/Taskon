import { ProjectRole, TeamRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  authorizeProject,
  authorizeTeam,
  resolveProjectContext,
} from "../../authorization/authorize.js";
import {
  meusProjetos,
  projetosAtivosVisiveis,
  projetosQueParticipo,
} from "../../authorization/scopes.js";
import { registrarAtividade } from "../../lib/activity-log.js";
import { naoEncontrado, regraDeNegocio } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { nomeDoAutor, notificarVarios } from "../notifications/notifications.service.js";
import { garantirQueNaoEhCaixaDeEntrada, obterCaixaDeEntrada } from "./inbox.js";
import type { Difficulty, Prisma, TaskPriority, TaskStatus } from "@prisma/client";
import { dataPura } from "../../lib/datas.js";

/**
 * Projetos.
 *
 * O acesso ao conteúdo vem só de `project_members` — pertencer à equipe dona
 * não basta. A única exceção é o GESTOR da equipe, que alcança todos os
 * projetos dela para que nenhum fique órfão se o dono sair.
 */

const resumoDoProjeto = {
  id: true,
  name: true,
  description: true,
  ownerId: true,
  teamId: true,
  isInbox: true,
  status: true,
  priority: true,
  difficulty: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  updatedBy: { select: { id: true, name: true, image: true } },
} as const;

/** Participantes para os avatares do cartão: o dono primeiro. */
const membrosDoCartao = {
  select: {
    role: true,
    user: { select: { id: true, name: true, email: true, image: true } },
  },
  orderBy: [{ role: "asc" }, { createdAt: "asc" }],
} satisfies Prisma.Project$membersArgs;

// --- Leitura ---------------------------------------------------------------

export async function listarProjetos(userId: string, limite = 15) {
  // A Caixa de entrada mora na Home, não nestas duas listas.
  const filtroMeus = { ...meusProjetos(userId), isInbox: false };
  const filtroParticipo = { ...projetosQueParticipo(userId), isInbox: false };

  const [meus, participo, totalMeus, totalParticipo, caixaDeEntrada] =
    await Promise.all([
      prisma.project.findMany({
        where: filtroMeus,
        select: {
          ...resumoDoProjeto,
          team: { select: { id: true, name: true } },
          _count: { select: { tasks: { where: { deletedAt: null } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: limite,
      }),
      prisma.project.findMany({
        where: filtroParticipo,
        select: {
          ...resumoDoProjeto,
          team: { select: { id: true, name: true } },
          _count: { select: { tasks: { where: { deletedAt: null } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: limite,
      }),
      prisma.project.count({ where: filtroMeus }),
      prisma.project.count({ where: filtroParticipo }),
      obterCaixaDeEntrada(userId),
    ]);

  return {
    meus,
    participo,
    // O "ver todos" só faz sentido quando há mais do que o limite exibido.
    totais: { meus: totalMeus, participo: totalParticipo },
    caixaDeEntrada: { id: caixaDeEntrada.id, name: caixaDeEntrada.name },
  };
}

/**
 * Todos os projetos visíveis (sem paginação), para a página "Ver todos".
 *
 * Cada item já vem com `escopo` calculado a partir de `teamId` — a mesma
 * regra de `meusProjetos`/`projetosQueParticipo` acima — para o filtro
 * tri-estado da tela não precisar recalcular nada.
 */
export async function listarTodosOsProjetos(userId: string) {
  const projetos = await prisma.project.findMany({
    where: { ...projetosAtivosVisiveis(userId), isInbox: false },
    select: {
      ...resumoDoProjeto,
      team: { select: { id: true, name: true } },
      members: membrosDoCartao,
      _count: { select: { tasks: { where: { deletedAt: null } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return projetos.map((projeto) => ({
    ...projeto,
    escopo: projeto.teamId ? ("EQUIPE" as const) : ("PESSOAL" as const),
  }));
}

export async function obterProjeto(userId: string, projectId: string) {
  const ctx = await authorizeProject(userId, projectId, "projeto.ver");

  const [membros, equipe, autor] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    ctx.project.teamId
      ? prisma.team.findUnique({
          where: { id: ctx.project.teamId },
          select: { id: true, name: true },
        })
      : null,
    ctx.project.updatedById
      ? prisma.user.findUnique({
          where: { id: ctx.project.updatedById },
          select: { id: true, name: true, image: true },
        })
      : null,
  ]);

  return {
    projeto: { ...ctx.project, updatedBy: autor },
    equipe,
    membros,
    meuPapel: ctx.role,
    souDono: ctx.isOwner,
    viaGestorDaEquipe: ctx.viaGestorDaEquipe,
  };
}

// --- Escrita ---------------------------------------------------------------

export async function criarProjeto(
  userId: string,
  dados: {
    name: string;
    description?: string;
    teamId?: string | null;
    priority?: TaskPriority;
    difficulty?: Difficulty | null;
    dueDate?: string | null;
  },
) {
  // Criar projeto numa equipe é ação da equipe, não do projeto: quem decide é
  // a matriz da equipe (GESTOR e MEMBRO podem; VISUALIZADOR não).
  if (dados.teamId) {
    await authorizeTeam(userId, dados.teamId, "equipe.projeto.criar");
  }

  return prisma.$transaction(async (tx) => {
    const projeto = await tx.project.create({
      data: {
        name: dados.name,
        description: dados.description ?? null,
        ...(dados.priority && { priority: dados.priority }),
        difficulty: dados.difficulty ?? null,
        dueDate: dados.dueDate ? dataPura(dados.dueDate) : null,
        ownerId: userId,
        updatedById: userId,
        teamId: dados.teamId ?? null,
        // Invariante: o dono é sempre também OWNER em project_members, para a
        // autorização consultar uma tabela só.
        members: { create: { userId, role: ProjectRole.OWNER } },
      },
      select: resumoDoProjeto,
    });

    await registrarAtividade(
      {
        entityType: "PROJETO",
        entityId: projeto.id,
        projectId: projeto.id,
        actorId: userId,
        action: "CRIADO",
        after: { name: projeto.name, teamId: projeto.teamId },
      },
      tx,
    );

    return projeto;
  });
}

export async function atualizarProjeto(
  userId: string,
  projectId: string,
  dados: {
    name?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    difficulty?: Difficulty | null;
    dueDate?: string | null;
  },
) {
  const ctx = await authorizeProject(userId, projectId, "projeto.editar");

  return prisma.$transaction(async (tx) => {
    const atualizado = await tx.project.update({
      where: { id: projectId },
      data: {
        updatedById: userId,
        ...(dados.name !== undefined && { name: dados.name }),
        ...(dados.description !== undefined && { description: dados.description }),
        ...(dados.status !== undefined && { status: dados.status }),
        ...(dados.priority !== undefined && { priority: dados.priority }),
        ...(dados.difficulty !== undefined && { difficulty: dados.difficulty }),
        ...(dados.dueDate !== undefined && {
          dueDate: dados.dueDate ? dataPura(dados.dueDate) : null,
        }),
      },
      select: resumoDoProjeto,
    });

    await registrarAtividade(
      {
        entityType: "PROJETO",
        entityId: projectId,
        projectId,
        actorId: userId,
        action: "ATUALIZADO",
        before: {
          name: ctx.project.name,
          description: ctx.project.description,
          status: ctx.project.status,
          priority: ctx.project.priority,
          difficulty: ctx.project.difficulty,
          dueDate: ctx.project.dueDate,
        },
        after: {
          name: atualizado.name,
          description: atualizado.description,
          status: atualizado.status,
          priority: atualizado.priority,
          difficulty: atualizado.difficulty,
          dueDate: atualizado.dueDate,
        },
      },
      tx,
    );

    return atualizado;
  });
}

/**
 * Envia o projeto para a Lixeira.
 *
 * As tarefas vão junto, marcadas com o mesmo `deletionBatchId`. Esse lote é o
 * que permite, na restauração, devolver exatamente o que foi excluído nesta
 * operação — e não tarefas que já estavam na Lixeira antes.
 */
export async function excluirProjeto(userId: string, projectId: string) {
  const ctx = await authorizeProject(userId, projectId, "projeto.excluir");
  garantirQueNaoEhCaixaDeEntrada(ctx.project, "excluída");

  const agora = new Date();
  const lote = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { projectId, deletedAt: null },
      data: { deletedAt: agora, deletedBy: userId, deletionBatchId: lote },
    });

    await tx.project.update({
      where: { id: projectId },
      data: { deletedAt: agora, deletedBy: userId, deletionBatchId: lote },
    });

    await registrarAtividade(
      {
        entityType: "PROJETO",
        entityId: projectId,
        projectId,
        actorId: userId,
        action: "EXCLUIDO",
        before: { name: ctx.project.name },
        after: { deletionBatchId: lote },
      },
      tx,
    );
  });

  return { deletionBatchId: lote };
}

// --- Membros ---------------------------------------------------------------

export async function adicionarMembro(
  userId: string,
  projectId: string,
  dados: { userId: string; role: ProjectRole },
) {
  const ctx = await authorizeProject(userId, projectId, "projeto.membros.gerenciar");
  garantirQueNaoEhCaixaDeEntrada(ctx.project, "compartilhada");

  if (dados.role === ProjectRole.OWNER) {
    throw regraDeNegocio(
      "Há um único proprietário por projeto. Use a transferência de propriedade.",
    );
  }

  const convidado = await prisma.user.findUnique({
    where: { id: dados.userId },
    select: { id: true, anonymizedAt: true },
  });
  if (!convidado || convidado.anonymizedAt) throw naoEncontrado("Usuário");

  // Projeto de equipe só aceita quem já é da equipe: é o que dá sentido ao
  // projeto "de equipe" e mantém a invariante do modelo.
  if (ctx.project.teamId) {
    const naEquipe = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: ctx.project.teamId, userId: dados.userId } },
    });
    if (!naEquipe) {
      throw regraDeNegocio(
        "Em um projeto de equipe, só é possível incluir membros da própria equipe.",
      );
    }
  } else {
    // Projeto pessoal: o id vem do cliente. Sem vínculo exigido, qualquer
    // UUID viraria membro e receberia o aviso. Vale a regra das reuniões:
    // só quem divide alguma equipe com quem está adicionando.
    const divideEquipe = await prisma.teamMember.findFirst({
      where: { userId: dados.userId, team: { members: { some: { userId } } } },
      select: { teamId: true },
    });
    if (!divideEquipe) {
      throw regraDeNegocio("Só é possível incluir pessoas das suas equipes.");
    }
  }

  const jaMembro = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: dados.userId } },
  });
  if (jaMembro) throw regraDeNegocio("Esta pessoa já participa do projeto.");

  const membro = await prisma.$transaction(async (tx) => {
    const criado = await tx.projectMember.create({
      data: { projectId, userId: dados.userId, role: dados.role },
    });

    await registrarAtividade(
      {
        entityType: "PROJETO",
        entityId: projectId,
        projectId,
        actorId: userId,
        action: "MEMBRO_ADICIONADO",
        after: { userId: dados.userId, role: dados.role },
      },
      tx,
    );

    return criado;
  });

  await notificarVarios(
    [dados.userId],
    {
      type: "CONVITE_PROJETO",
      payload: {
        evento: "ADICIONADO_AO_PROJETO",
        projectId,
        projectName: ctx.project.name,
        role: dados.role,
        autorNome: await nomeDoAutor(userId),
      },
    },
    userId,
  );

  return membro;
}

export async function alterarPapelDeMembro(
  userId: string,
  projectId: string,
  membroId: string,
  novoPapel: ProjectRole,
) {
  const ctx = await authorizeProject(userId, projectId, "projeto.membros.gerenciar");

  if (novoPapel === ProjectRole.OWNER) {
    throw regraDeNegocio(
      "Há um único proprietário por projeto. Use a transferência de propriedade.",
    );
  }
  if (membroId === ctx.project.ownerId) {
    throw regraDeNegocio(
      "O proprietário não muda de papel. Transfira a propriedade antes.",
    );
  }

  const membro = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: membroId } },
  });
  if (!membro) throw naoEncontrado("Membro");

  const atualizado = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.projectMember.update({
      where: { projectId_userId: { projectId, userId: membroId } },
      data: { role: novoPapel },
    });

    await registrarAtividade(
      {
        entityType: "PROJETO",
        entityId: projectId,
        projectId,
        actorId: userId,
        action: "PAPEL_ALTERADO",
        before: { userId: membroId, role: membro.role },
        after: { userId: membroId, role: novoPapel },
      },
      tx,
    );

    return atualizado;
  });

  // O papel decide o que a pessoa pode fazer no projeto: vale avisar.
  if (novoPapel !== membro.role) {
    await notificarVarios(
      [membroId],
      {
        type: "CONVITE_PROJETO",
        payload: {
          evento: "PAPEL_ALTERADO",
          projectId,
          projectName: ctx.project.name,
          role: novoPapel,
          autorNome: await nomeDoAutor(userId),
        },
      },
      userId,
    );
  }

  return atualizado;
}

export async function removerMembro(
  userId: string,
  projectId: string,
  membroId: string,
) {
  const souEu = userId === membroId;
  const ctx = souEu
    ? await resolveProjectContext(userId, projectId)
    : await authorizeProject(userId, projectId, "projeto.membros.gerenciar");

  if (!ctx) throw naoEncontrado("Projeto");

  if (membroId === ctx.project.ownerId) {
    throw regraDeNegocio(
      "O proprietário não sai nem é removido. Transfira a propriedade antes.",
    );
  }

  const membro = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: membroId } },
  });
  if (!membro) throw naoEncontrado("Membro");

  await prisma.$transaction(async (tx) => {
    // Sem acesso ao projeto, não faz sentido continuar responsável por tarefas
    // dele. As tarefas continuam: o trabalho não some com a pessoa.
    await tx.taskAssignee.deleteMany({
      where: { userId: membroId, task: { projectId } },
    });

    await tx.projectMember.delete({
      where: { projectId_userId: { projectId, userId: membroId } },
    });

    await registrarAtividade(
      {
        entityType: "PROJETO",
        entityId: projectId,
        projectId,
        actorId: userId,
        action: "MEMBRO_REMOVIDO",
        before: { userId: membroId, role: membro.role },
      },
      tx,
    );
  });

  // Quem sai por conta própria já sabe; quem é removido por outra pessoa, não.
  if (!souEu) {
    await notificarVarios(
      [membroId],
      {
        type: "CONVITE_PROJETO",
        payload: {
          evento: "REMOVIDO_DO_PROJETO",
          projectName: ctx.project.name,
          autorNome: await nomeDoAutor(userId),
        },
      },
      userId,
    );
  }
}

export async function transferirPropriedade(
  userId: string,
  projectId: string,
  novoDonoId: string,
) {
  const ctx = await authorizeProject(
    userId,
    projectId,
    "projeto.propriedade.transferir",
  );
  garantirQueNaoEhCaixaDeEntrada(ctx.project, "transferida");

  if (novoDonoId === ctx.project.ownerId) {
    throw regraDeNegocio("Esta pessoa já é a proprietária do projeto.");
  }

  const novoDono = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: novoDonoId } },
  });
  if (!novoDono) {
    throw regraDeNegocio(
      "A propriedade só pode ser transferida a quem já participa do projeto.",
    );
  }

  const donoAnterior = ctx.project.ownerId;

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: { ownerId: novoDonoId, updatedById: userId },
    });

    await tx.projectMember.update({
      where: { projectId_userId: { projectId, userId: novoDonoId } },
      data: { role: ProjectRole.OWNER },
    });

    // O dono anterior continua no projeto, agora como EDITOR: perder o acesso
    // ao próprio trabalho ao passar a responsabilidade seria surpreendente.
    await tx.projectMember.update({
      where: { projectId_userId: { projectId, userId: donoAnterior } },
      data: { role: ProjectRole.EDITOR },
    });

    await registrarAtividade(
      {
        entityType: "PROJETO",
        entityId: projectId,
        projectId,
        actorId: userId,
        action: "PROPRIEDADE_TRANSFERIDA",
        before: { ownerId: donoAnterior },
        after: { ownerId: novoDonoId },
      },
      tx,
    );
  });

  await notificarVarios(
    [novoDonoId],
    {
      type: "CONVITE_PROJETO",
      payload: {
        evento: "PROPRIEDADE_RECEBIDA",
        projectId,
        projectName: ctx.project.name,
        autorNome: await nomeDoAutor(userId),
      },
    },
    userId,
  );
}

/**
 * Pessoas que podem ser adicionadas ao projeto.
 *
 * Em projeto de equipe, os candidatos são os membros da equipe que ainda não
 * participam. Em projeto pessoal, a inclusão é por e-mail e não há lista.
 */
export async function candidatosAMembro(userId: string, projectId: string) {
  const ctx = await authorizeProject(userId, projectId, "projeto.membros.gerenciar");
  if (!ctx.project.teamId) return [];

  return prisma.user
    .findMany({
      where: {
        teamMemberships: { some: { teamId: ctx.project.teamId } },
        projectMemberships: { none: { projectId } },
      },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    })
    .then((usuarios) => usuarios);
}

/** Papel de alguém na equipe dona, para a interface sugerir o papel no projeto. */
export async function papelNaEquipeDoProjeto(
  teamId: string,
  userId: string,
): Promise<TeamRole | null> {
  const membro = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  return membro?.role ?? null;
}
