import {
  projetosNaLixeira,
  tarefasNaLixeira,
} from "../../authorization/scopes.js";
import { registrarAtividade } from "../../lib/activity-log.js";
import { AppError, naoEncontrado, regraDeNegocio } from "../../lib/errors.js";
import { log } from "../../lib/log.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Lixeira.
 *
 * A exclusão é lógica e em lote: o `deletionBatchId` registra o que saiu numa
 * operação, e é ele que permite devolver exatamente aquilo — sem ressuscitar o
 * que já estava descartado antes.
 */

/** Itens são apagados de vez 30 dias depois de irem para a Lixeira. */
export const DIAS_ATE_A_PURGA = 30;

const resumoDoProjeto = {
  id: true,
  name: true,
  deletedAt: true,
  deletionBatchId: true,
  team: { select: { id: true, name: true } },
  _count: { select: { tasks: true } },
} as const;

const resumoDaTarefa = {
  id: true,
  title: true,
  status: true,
  priority: true,
  deletedAt: true,
  deletionBatchId: true,
  project: { select: { id: true, name: true } },
} as const;

// --- Leitura ---------------------------------------------------------------

/** Teto da página da Lixeira: os itens somem em 30 dias, então ela é curta. */
export const TETO_DA_LIXEIRA = 500;

export async function listarLixeira(userId: string, limite = 15) {
  const [projetos, tarefas, totalProjetos, totalTarefas] = await Promise.all([
    prisma.project.findMany({
      where: projetosNaLixeira(userId),
      select: resumoDoProjeto,
      orderBy: { deletedAt: "desc" },
      take: limite,
    }),
    prisma.task.findMany({
      where: tarefasNaLixeira(userId),
      select: resumoDaTarefa,
      orderBy: { deletedAt: "desc" },
      take: limite,
    }),
    prisma.project.count({ where: projetosNaLixeira(userId) }),
    prisma.task.count({ where: tarefasNaLixeira(userId) }),
  ]);

  return {
    projetos,
    tarefas,
    totais: { projetos: totalProjetos, tarefas: totalTarefas },
    diasAteAPurga: DIAS_ATE_A_PURGA,
  };
}

// --- Restauração -----------------------------------------------------------

/**
 * Restaura um projeto e, com ele, só as tarefas que saíram no mesmo lote.
 *
 * Tarefas excluídas antes continuam na Lixeira: restaurar o projeto não é um
 * pedido para desfazer tudo o que já tinha sido descartado nele.
 */
export async function restaurarProjeto(userId: string, projectId: string) {
  const projeto = await prisma.project.findFirst({
    where: { id: projectId, ...projetosNaLixeira(userId) },
  });
  if (!projeto) throw naoEncontrado("Projeto");

  const lote = projeto.deletionBatchId;

  const restauradas = await prisma.$transaction(async (tx) => {
    const { count } = lote
      ? await tx.task.updateMany({
          where: { projectId, deletionBatchId: lote },
          data: { deletedAt: null, deletedBy: null, deletionBatchId: null },
        })
      : { count: 0 };

    await tx.project.update({
      where: { id: projectId },
      data: {
        deletedAt: null,
        deletedBy: null,
        deletionBatchId: null,
        updatedById: userId,
      },
    });

    await registrarAtividade(
      {
        entityType: "PROJETO",
        entityId: projectId,
        projectId,
        actorId: userId,
        action: "RESTAURADO",
        after: { tarefasRestauradas: count },
      },
      tx,
    );

    return count;
  });

  return { projectId, tarefasRestauradas: restauradas };
}

/** Restaura uma tarefa e suas subtarefas do mesmo lote. */
export async function restaurarTarefa(userId: string, taskId: string) {
  const tarefa = await prisma.task.findFirst({
    where: { id: taskId, ...tarefasNaLixeira(userId) },
    select: { id: true, projectId: true, deletionBatchId: true },
  });

  if (!tarefa) {
    // Pode não existir, não ser acessível, ou estar num projeto excluído.
    // Neste último caso a mensagem precisa orientar, não apenas negar.
    const emProjetoExcluido = await prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: { not: null },
        project: { deletedAt: { not: null } },
      },
      select: { id: true },
    });
    if (emProjetoExcluido) {
      throw regraDeNegocio(
        "Esta tarefa está em um projeto excluído. Restaure o projeto para recuperá-la.",
      );
    }
    throw naoEncontrado("Tarefa");
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: tarefa.deletionBatchId
        ? {
            deletionBatchId: tarefa.deletionBatchId,
            OR: [{ id: taskId }, { parentId: taskId }],
          }
        : { id: taskId },
      data: { deletedAt: null, deletedBy: null, deletionBatchId: null },
    });

    await registrarAtividade(
      {
        entityType: "TAREFA",
        entityId: taskId,
        projectId: tarefa.projectId,
        actorId: userId,
        action: "RESTAURADO",
      },
      tx,
    );
  });

  return { taskId };
}

// --- Exclusão definitiva ---------------------------------------------------

export async function excluirProjetoDefinitivamente(
  userId: string,
  projectId: string,
) {
  const projeto = await prisma.project.findFirst({
    where: { id: projectId, ...projetosNaLixeira(userId) },
    select: { id: true },
  });
  if (!projeto) throw naoEncontrado("Projeto");

  // As tarefas somem em cascata pela chave estrangeira; o histórico do projeto
  // também, porque deixa de ter a que se referir.
  await prisma.project.delete({ where: { id: projectId } });
}

export async function excluirTarefaDefinitivamente(userId: string, taskId: string) {
  const tarefa = await prisma.task.findFirst({
    where: { id: taskId, ...tarefasNaLixeira(userId) },
    select: { id: true },
  });
  if (!tarefa) throw naoEncontrado("Tarefa");

  await prisma.task.delete({ where: { id: taskId } });
}

// --- Operações em lote -----------------------------------------------------

export interface SelecaoDaLixeira {
  projetos: string[];
  tarefas: string[];
}

export interface FalhaNoLote {
  tipo: "projeto" | "tarefa";
  id: string;
  motivo: string;
}

export interface ResultadoDoLote {
  projetos: string[];
  tarefas: string[];
  falhas: FalhaNoLote[];
}

/**
 * Aplica a mesma ação item a item, sem "tudo ou nada".
 *
 * Numa seleção grande, um item pode já ter sido restaurado ou apagado por
 * outra pessoa; recusar o lote inteiro por causa dele deixaria o usuário sem
 * saída. Cada item reutiliza a operação individual, com as mesmas regras de
 * permissão, e o que falha volta com o motivo.
 */
async function emLote(
  userId: string,
  selecao: SelecaoDaLixeira,
  acoes: {
    projeto: (userId: string, id: string) => Promise<unknown>;
    tarefa: (userId: string, id: string) => Promise<unknown>;
  },
): Promise<ResultadoDoLote> {
  const resultado: ResultadoDoLote = { projetos: [], tarefas: [], falhas: [] };

  // Projetos primeiro: são independentes das tarefas listadas, que por
  // definição estão em projetos ativos.
  for (const id of new Set(selecao.projetos)) {
    try {
      await acoes.projeto(userId, id);
      resultado.projetos.push(id);
    } catch (erro) {
      resultado.falhas.push({ tipo: "projeto", id, motivo: motivoDe(erro) });
    }
  }
  for (const id of new Set(selecao.tarefas)) {
    try {
      await acoes.tarefa(userId, id);
      resultado.tarefas.push(id);
    } catch (erro) {
      resultado.falhas.push({ tipo: "tarefa", id, motivo: motivoDe(erro) });
    }
  }

  return resultado;
}

/**
 * Só erros de domínio têm mensagem pensada para o usuário. Qualquer outro
 * (do banco, por exemplo) traria detalhes internos para a resposta: vai para
 * o log e o usuário recebe uma mensagem genérica.
 */
function motivoDe(erro: unknown) {
  if (erro instanceof AppError) return erro.message;
  log.error({ err: erro }, "Falha num item do lote da lixeira");
  return "Não foi possível concluir.";
}

export function restaurarEmLote(userId: string, selecao: SelecaoDaLixeira) {
  return emLote(userId, selecao, {
    projeto: restaurarProjeto,
    tarefa: restaurarTarefa,
  });
}

export function excluirEmLoteDefinitivamente(
  userId: string,
  selecao: SelecaoDaLixeira,
) {
  return emLote(userId, selecao, {
    projeto: excluirProjetoDefinitivamente,
    tarefa: excluirTarefaDefinitivamente,
  });
}

/**
 * Esvazia a Lixeira do usuário: só o que ele mesmo poderia excluir de vez,
 * nunca a Lixeira dos outros.
 */
export async function esvaziarLixeira(userId: string) {
  // As tarefas primeiro: o escopo delas exige projeto ativo, então não se
  // confundem com as que vão embora em cascata junto com um projeto.
  const tarefas = await prisma.task.deleteMany({ where: tarefasNaLixeira(userId) });
  const projetos = await prisma.project.deleteMany({
    where: projetosNaLixeira(userId),
  });

  return { projetosApagados: projetos.count, tarefasApagadas: tarefas.count };
}

// --- Purga automática ------------------------------------------------------

/**
 * Apaga de vez o que está na Lixeira há mais de 30 dias.
 *
 * Roda pelo agendador do host, sem usuário logado: por isso não há verificação
 * de permissão aqui — a rota que a dispara é protegida por segredo.
 */
export async function purgarLixeiraAntiga(agora = new Date()) {
  const limite = new Date(agora);
  limite.setDate(limite.getDate() - DIAS_ATE_A_PURGA);

  // Projetos primeiro: suas tarefas somem junto, e contá-las antes evitaria
  // relatar o mesmo item duas vezes.
  const projetos = await prisma.project.deleteMany({
    where: { deletedAt: { lt: limite } },
  });
  const tarefas = await prisma.task.deleteMany({
    where: { deletedAt: { lt: limite } },
  });

  return { projetosApagados: projetos.count, tarefasApagadas: tarefas.count };
}
