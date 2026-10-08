import { ProjectRole, TeamRole, type Project, type Team } from "@prisma/client";
import { prisma, type PrismaTx } from "../lib/prisma.js";
import { naoEncontrado, semPermissao } from "../lib/errors.js";
import { maiorPapelProjeto } from "./roles.js";
import {
  acoesExclusivasDoDonoDaEquipe,
  papelPermiteNaEquipe,
  papelPermiteNoProjeto,
  type ProjectAction,
  type TeamAction,
} from "./policies.js";

/**
 * Ponto único de decisão de acesso.
 *
 * Nenhum serviço, rota ou consulta deve inspecionar papéis por conta própria:
 * todos passam por aqui. Regras em `policies.ts`, resolução de contexto aqui.
 *
 * Princípio: recurso sem relação com o usuário é *invisível*. Por isso a falta
 * de acesso de leitura devolve "não encontrado", nunca "sem permissão" — senão
 * o erro já confirmaria que o recurso existe.
 */

export interface TeamContext {
  team: Team;
  role: TeamRole;
  isOwner: boolean;
}

export interface ProjectContext {
  project: Project;
  /** Papel efetivo: o maior entre o papel de membro e a exceção do GESTOR da equipe. */
  role: ProjectRole;
  /** Dono formal do projeto (`projects.ownerId`). */
  isOwner: boolean;
  /** Acesso obtido pela exceção administrativa do GESTOR da equipe. */
  viaGestorDaEquipe: boolean;
}

// --- Equipes ---------------------------------------------------------------

export async function resolveTeamContext(
  userId: string,
  teamId: string,
  db: PrismaTx = prisma,
): Promise<TeamContext | null> {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) return null;

  const membership = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (!membership) return null;

  return { team, role: membership.role, isOwner: team.ownerId === userId };
}

export async function authorizeTeam(
  userId: string,
  teamId: string,
  action: TeamAction,
  db: PrismaTx = prisma,
): Promise<TeamContext> {
  const ctx = await resolveTeamContext(userId, teamId, db);
  // Sem vínculo, a equipe não existe do ponto de vista deste usuário.
  if (!ctx) throw naoEncontrado("Equipe");

  if (acoesExclusivasDoDonoDaEquipe.has(action)) {
    if (!ctx.isOwner) throw semPermissao("esta ação, exclusiva do dono da equipe");
    return ctx;
  }

  if (!papelPermiteNaEquipe(ctx.role, action)) {
    throw semPermissao(descricaoEquipe[action]);
  }
  return ctx;
}

const descricaoEquipe: Record<TeamAction, string> = {
  "equipe.ver": "ver esta equipe",
  "equipe.editar": "editar esta equipe",
  "equipe.membros.gerenciar": "gerenciar os membros desta equipe",
  "equipe.projeto.criar": "criar projetos nesta equipe",
  "equipe.propriedade.transferir": "transferir a propriedade desta equipe",
  "equipe.excluir": "excluir esta equipe",
};

// --- Projetos --------------------------------------------------------------

interface ResolveProjectOptions {
  /** Necessário nas operações da Lixeira, que atuam sobre projetos excluídos. */
  incluirExcluidos?: boolean;
}

export async function resolveProjectContext(
  userId: string,
  projectId: string,
  db: PrismaTx = prisma,
  options: ResolveProjectOptions = {},
): Promise<ProjectContext | null> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  if (project.deletedAt && !options.incluirExcluidos) return null;

  const membership = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  // Exceção administrativa: o GESTOR da equipe alcança todos os projetos dela,
  // mesmo sem ser membro, para que um projeto não fique órfão se o dono sair.
  let viaGestorDaEquipe = false;
  if (project.teamId) {
    const teamMembership = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId: project.teamId, userId } },
    });
    viaGestorDaEquipe = teamMembership?.role === TeamRole.GESTOR;
  }

  const role = maiorPapelProjeto(
    membership?.role,
    viaGestorDaEquipe ? ProjectRole.OWNER : null,
  );
  if (!role) return null;

  return {
    project,
    role,
    isOwner: project.ownerId === userId,
    viaGestorDaEquipe,
  };
}

export async function authorizeProject(
  userId: string,
  projectId: string,
  action: ProjectAction,
  db: PrismaTx = prisma,
  options: ResolveProjectOptions = {},
): Promise<ProjectContext> {
  const ctx = await resolveProjectContext(userId, projectId, db, options);
  if (!ctx) throw naoEncontrado("Projeto");

  if (!papelPermiteNoProjeto(ctx.role, action)) {
    throw semPermissao(descricaoProjeto[action]);
  }
  return ctx;
}

const descricaoProjeto: Record<ProjectAction, string> = {
  "projeto.ver": "ver este projeto",
  "projeto.editar": "editar este projeto",
  "projeto.excluir": "excluir este projeto",
  "projeto.membros.gerenciar": "gerenciar os membros deste projeto",
  "projeto.propriedade.transferir": "transferir a propriedade deste projeto",
  "tarefa.criar": "criar tarefas neste projeto",
  "tarefa.editar": "editar tarefas neste projeto",
  "tarefa.excluir.qualquer": "excluir esta tarefa",
  "tarefa.excluir.propria": "excluir tarefas neste projeto",
  "comentario.criar": "comentar neste projeto",
  "comentario.remover.qualquer": "remover comentários de outras pessoas",
};

// --- Regras que dependem do recurso, não só do papel -----------------------

/**
 * Exclusão de tarefa: OWNER exclui qualquer uma, EDITOR só as que criou.
 * Decidir isso exige a tarefa em mãos, por isso não cabe na matriz pura.
 */
export function podeExcluirTarefa(
  ctx: ProjectContext,
  tarefa: { createdById: string },
  userId: string,
): boolean {
  if (papelPermiteNoProjeto(ctx.role, "tarefa.excluir.qualquer")) return true;
  return (
    papelPermiteNoProjeto(ctx.role, "tarefa.excluir.propria") &&
    tarefa.createdById === userId
  );
}

export function garantirExclusaoDeTarefa(
  ctx: ProjectContext,
  tarefa: { createdById: string },
  userId: string,
): void {
  if (!podeExcluirTarefa(ctx, tarefa, userId)) {
    throw semPermissao("excluir esta tarefa");
  }
}

/**
 * Comentário: o autor edita e exclui o próprio; o OWNER remove os de outros.
 * VIEWER não chega aqui, porque nem sequer pode criar comentário.
 */
export function podeRemoverComentario(
  ctx: ProjectContext,
  comentario: { authorId: string },
  userId: string,
): boolean {
  if (comentario.authorId === userId) return true;
  return papelPermiteNoProjeto(ctx.role, "comentario.remover.qualquer");
}

export function garantirRemocaoDeComentario(
  ctx: ProjectContext,
  comentario: { authorId: string },
  userId: string,
): void {
  if (!podeRemoverComentario(ctx, comentario, userId)) {
    throw semPermissao("remover este comentário");
  }
}

/** Editar comentário é sempre restrito ao autor, sem exceção para o OWNER. */
export function garantirEdicaoDeComentario(
  comentario: { authorId: string },
  userId: string,
): void {
  if (comentario.authorId !== userId) {
    throw semPermissao("editar um comentário de outra pessoa");
  }
}
