import { ViewEntityType, ViewMode, ViewPage } from "@prisma/client";
import { authorizeProject } from "../../authorization/authorize.js";
import { prisma } from "../../lib/prisma.js";
import { naoEncontrado } from "../../lib/errors.js";

/**
 * Visualização escolhida (Cards, Kanban ou Lista).
 *
 * Fica no banco, por usuário e por página, porque o prompt pede que a escolha
 * seja respeitada ao voltar — inclusive de outro dispositivo. As abas abertas,
 * por serem conveniência local, ficam no navegador.
 */

export async function obterVisualizacao(
  userId: string,
  entityType: ViewEntityType,
  entityId: string,
): Promise<ViewMode | null> {
  const preferencia = await prisma.userViewPreference.findUnique({
    where: {
      userId_entityType_entityId: { userId, entityType, entityId },
    },
  });
  return preferencia?.view ?? null;
}

export async function definirVisualizacao(
  userId: string,
  entityType: ViewEntityType,
  entityId: string,
  view: ViewMode,
): Promise<void> {
  // Guardar preferência para um recurso invisível revelaria sua existência e
  // deixaria lixo no banco, então o acesso é verificado antes.
  await garantirAcesso(userId, entityType, entityId);

  await prisma.userViewPreference.upsert({
    where: { userId_entityType_entityId: { userId, entityType, entityId } },
    create: { userId, entityType, entityId, view },
    update: { view },
  });
}

/**
 * Visualização das páginas de listagem ("Todos os projetos", "Todas as
 * tarefas"). Não há recurso por trás, então não há acesso a verificar: a
 * página é a mesma para todo usuário, e a preferência é só dele.
 */
export async function obterVisualizacaoDaPagina(
  userId: string,
  page: ViewPage,
): Promise<ViewMode | null> {
  const preferencia = await prisma.userPageViewPreference.findUnique({
    where: { userId_page: { userId, page } },
  });
  return preferencia?.view ?? null;
}

export async function definirVisualizacaoDaPagina(
  userId: string,
  page: ViewPage,
  view: ViewMode,
): Promise<void> {
  await prisma.userPageViewPreference.upsert({
    where: { userId_page: { userId, page } },
    create: { userId, page, view },
    update: { view },
  });
}

async function garantirAcesso(
  userId: string,
  entityType: ViewEntityType,
  entityId: string,
): Promise<void> {
  if (entityType === ViewEntityType.PROJETO) {
    await authorizeProject(userId, entityId, "projeto.ver");
    return;
  }

  const tarefa = await prisma.task.findFirst({
    where: { id: entityId, deletedAt: null },
    select: { projectId: true },
  });
  if (!tarefa) throw naoEncontrado("Tarefa");
  await authorizeProject(userId, tarefa.projectId, "projeto.ver");
}
