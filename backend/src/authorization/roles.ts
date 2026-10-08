import { ProjectRole, TeamRole } from "@prisma/client";

/**
 * Hierarquias de papel. Existem para comparar papéis, nunca para decidir ações:
 * quem decide ação é a matriz em `policies.ts`.
 */

const ordemProjeto: Record<ProjectRole, number> = {
  [ProjectRole.VIEWER]: 1,
  [ProjectRole.EDITOR]: 2,
  [ProjectRole.OWNER]: 3,
};

const ordemEquipe: Record<TeamRole, number> = {
  [TeamRole.VISUALIZADOR]: 1,
  [TeamRole.MEMBRO]: 2,
  [TeamRole.GESTOR]: 3,
};

export const nivelProjeto = (role: ProjectRole): number => ordemProjeto[role];
export const nivelEquipe = (role: TeamRole): number => ordemEquipe[role];

/** Devolve o maior entre dois papéis de projeto, ignorando os ausentes. */
export function maiorPapelProjeto(
  a: ProjectRole | null | undefined,
  b: ProjectRole | null | undefined,
): ProjectRole | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return nivelProjeto(a) >= nivelProjeto(b) ? a : b;
}

export const peloMenosProjeto = (
  atual: ProjectRole,
  minimo: ProjectRole,
): boolean => nivelProjeto(atual) >= nivelProjeto(minimo);

export const peloMenosEquipe = (atual: TeamRole, minimo: TeamRole): boolean =>
  nivelEquipe(atual) >= nivelEquipe(minimo);
