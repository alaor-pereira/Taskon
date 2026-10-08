import { ProjectRole, TeamRole } from "@prisma/client";

/**
 * As matrizes de permissão, em forma de dado.
 *
 * Esta é a única tradução das matrizes de equipe e de projeto em código —
 * nenhum serviço repete estas regras.
 */

// --- Equipe ----------------------------------------------------------------

export type TeamAction =
  | "equipe.ver"
  | "equipe.editar"
  | "equipe.membros.gerenciar"
  | "equipe.projeto.criar"
  | "equipe.propriedade.transferir"
  | "equipe.excluir";

/** Papéis que permitem cada ação. Ausência no mapa significa "ninguém por papel". */
const matrizEquipe: Record<TeamAction, ReadonlyArray<TeamRole>> = {
  "equipe.ver": [TeamRole.GESTOR, TeamRole.MEMBRO, TeamRole.VISUALIZADOR],
  "equipe.editar": [TeamRole.GESTOR],
  "equipe.membros.gerenciar": [TeamRole.GESTOR],
  "equipe.projeto.criar": [TeamRole.GESTOR, TeamRole.MEMBRO],
  // As duas abaixo são exclusivas do dono formal, verificado à parte.
  "equipe.propriedade.transferir": [],
  "equipe.excluir": [],
};

/** Ações que exigem ser o dono formal da equipe, não bastando ser GESTOR. */
export const acoesExclusivasDoDonoDaEquipe: ReadonlySet<TeamAction> = new Set([
  "equipe.propriedade.transferir",
  "equipe.excluir",
]);

export const papelPermiteNaEquipe = (
  role: TeamRole,
  action: TeamAction,
): boolean => matrizEquipe[action].includes(role);

// --- Projeto ---------------------------------------------------------------

export type ProjectAction =
  | "projeto.ver"
  | "projeto.editar"
  | "projeto.excluir"
  | "projeto.membros.gerenciar"
  | "projeto.propriedade.transferir"
  | "tarefa.criar"
  | "tarefa.editar"
  | "tarefa.excluir.qualquer"
  | "tarefa.excluir.propria"
  | "comentario.criar"
  | "comentario.remover.qualquer";

const matrizProjeto: Record<ProjectAction, ReadonlyArray<ProjectRole>> = {
  "projeto.ver": [ProjectRole.OWNER, ProjectRole.EDITOR, ProjectRole.VIEWER],
  "projeto.editar": [ProjectRole.OWNER, ProjectRole.EDITOR],
  "projeto.excluir": [ProjectRole.OWNER],
  "projeto.membros.gerenciar": [ProjectRole.OWNER],
  "projeto.propriedade.transferir": [ProjectRole.OWNER],
  "tarefa.criar": [ProjectRole.OWNER, ProjectRole.EDITOR],
  "tarefa.editar": [ProjectRole.OWNER, ProjectRole.EDITOR],
  "tarefa.excluir.qualquer": [ProjectRole.OWNER],
  "tarefa.excluir.propria": [ProjectRole.OWNER, ProjectRole.EDITOR],
  "comentario.criar": [ProjectRole.OWNER, ProjectRole.EDITOR],
  "comentario.remover.qualquer": [ProjectRole.OWNER],
};

export const papelPermiteNoProjeto = (
  role: ProjectRole,
  action: ProjectAction,
): boolean => matrizProjeto[action].includes(role);
