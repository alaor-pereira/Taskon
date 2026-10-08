import { ProjectRole, TeamRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

/**
 * Construtores de cenário para os testes.
 *
 * Criam linhas diretamente, sem passar pelo Better Auth: os testes verificam
 * regras de acesso, não o fluxo de cadastro.
 */

let contador = 0;
const proximo = () => ++contador;

export async function limparBanco(): Promise<void> {
  // A ordem importa: filhos antes dos pais, porque há chaves com Restrict.
  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.notificationPreference.deleteMany(),
    prisma.userAvatar.deleteMany(),
    prisma.invitation.deleteMany(),
    prisma.userViewPreference.deleteMany(),
    prisma.userPageViewPreference.deleteMany(),
    prisma.eventException.deleteMany(),
    prisma.eventParticipant.deleteMany(),
    prisma.calendarEvent.deleteMany(),
    prisma.commentMention.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.taskAssignee.deleteMany(),
    prisma.task.deleteMany(),
    prisma.projectMember.deleteMany(),
    prisma.project.deleteMany(),
    prisma.teamMember.deleteMany(),
    prisma.team.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.termsAcceptance.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function criarUsuario(nome?: string) {
  const n = proximo();
  return prisma.user.create({
    data: {
      name: nome ?? `Usuário ${n}`,
      email: `usuario${n}@teste.local`,
      emailVerified: true,
    },
  });
}

export async function criarEquipe(donoId: string, nome = "Equipe de teste") {
  return prisma.team.create({
    data: {
      name: nome,
      ownerId: donoId,
      // Invariante: o criador é dono e também GESTOR em team_members.
      members: { create: { userId: donoId, role: TeamRole.GESTOR } },
    },
  });
}

export async function adicionarAEquipe(
  teamId: string,
  userId: string,
  role: TeamRole,
) {
  return prisma.teamMember.create({ data: { teamId, userId, role } });
}

/**
 * Põe as pessoas numa mesma equipe (a primeira é a dona). Reuniões e projetos
 * pessoais só aceitam quem divide equipe com quem convida.
 */
export async function colegasDeEquipe(donoId: string, ...outrosIds: string[]) {
  const equipe = await criarEquipe(donoId, `Equipe ${proximo()}`);
  for (const id of outrosIds) await adicionarAEquipe(equipe.id, id, TeamRole.MEMBRO);
  return equipe;
}

export async function criarProjeto(
  donoId: string,
  opcoes: { teamId?: string; nome?: string; isInbox?: boolean } = {},
) {
  return prisma.project.create({
    data: {
      name: opcoes.nome ?? `Projeto ${proximo()}`,
      ownerId: donoId,
      teamId: opcoes.teamId ?? null,
      isInbox: opcoes.isInbox ?? false,
      // Invariante: o dono é sempre OWNER em project_members.
      members: { create: { userId: donoId, role: ProjectRole.OWNER } },
    },
  });
}

export async function adicionarAoProjeto(
  projectId: string,
  userId: string,
  role: ProjectRole,
) {
  return prisma.projectMember.create({ data: { projectId, userId, role } });
}

export async function criarTarefa(
  projectId: string,
  criadorId: string,
  dados: Partial<{ title: string; parentId: string }> = {},
) {
  return prisma.task.create({
    data: {
      projectId,
      title: dados.title ?? `Tarefa ${proximo()}`,
      createdById: criadorId,
      parentId: dados.parentId ?? null,
    },
  });
}
