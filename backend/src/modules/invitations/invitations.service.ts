import { InvitationStatus, InvitationType, TeamRole } from "@prisma/client";
import { authorizeTeam } from "../../authorization/authorize.js";
import { env } from "../../config/env.js";
import { registrarAtividade } from "../../lib/activity-log.js";
import { naoEncontrado, regraDeNegocio, semPermissao } from "../../lib/errors.js";
import { enviarEmail, escaparHtml, layoutEmail } from "../../lib/mailer.js";
import { prisma } from "../../lib/prisma.js";
import { dataDeExpiracaoDeConvite, gerarToken, hashToken } from "../../lib/tokens.js";
import { nomeDoAutor, notificar } from "../notifications/notifications.service.js";

/**
 * Convites para equipes.
 *
 * Quem já tem conta recebe o aviso dentro do aplicativo; só quem ainda não tem
 * recebe e-mail, com um link que leva ao cadastro. O convite fica pendente até
 * a resposta, e expira em 7 dias.
 */

const normalizarEmail = (email: string) => email.trim().toLowerCase();

// --- Envio -----------------------------------------------------------------

export async function convidarParaEquipe(
  userId: string,
  teamId: string,
  dados: { email: string; role: TeamRole },
) {
  const ctx = await authorizeTeam(userId, teamId, "equipe.membros.gerenciar");
  // Convidar como Gestor é criar um Gestor: só o dono pode (ver teams.service).
  if (dados.role === TeamRole.GESTOR && ctx.team.ownerId !== userId) {
    throw semPermissao("convidar alguém como Gestor; só o dono da equipe pode");
  }
  const email = normalizarEmail(dados.email);

  const convidado = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  if (convidado) {
    const jaMembro = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: convidado.id } },
    });
    if (jaMembro) throw regraDeNegocio("Esta pessoa já faz parte da equipe.");
  }

  // Um convite pendente por pessoa e equipe: reenviar renova em vez de acumular.
  const pendente = await prisma.invitation.findFirst({
    where: {
      teamId,
      email,
      status: InvitationStatus.PENDENTE,
      expiresAt: { gt: new Date() },
    },
  });

  const token = gerarToken();

  const convite = pendente
    ? await prisma.invitation.update({
        where: { id: pendente.id },
        data: {
          role: dados.role,
          tokenHash: token.hash,
          expiresAt: dataDeExpiracaoDeConvite(),
          invitedById: userId,
          invitedUserId: convidado?.id ?? null,
        },
      })
    : await prisma.invitation.create({
        data: {
          type: InvitationType.EQUIPE,
          teamId,
          email,
          invitedUserId: convidado?.id ?? null,
          role: dados.role,
          tokenHash: token.hash,
          status: InvitationStatus.PENDENTE,
          invitedById: userId,
          expiresAt: dataDeExpiracaoDeConvite(),
        },
      });

  const quemConvidou = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  if (convidado) {
    await notificar({
      userId: convidado.id,
      type: "CONVITE_EQUIPE",
      payload: {
        evento: "CONVITE_RECEBIDO",
        convidoId: convite.id,
        teamId,
        teamName: ctx.team.name,
        role: dados.role,
        convidadoPor: quemConvidou?.name ?? null,
      },
      dedupeKey: `convite:${convite.id}`,
    });
  } else {
    // Sem conta, não há onde mostrar a notificação: o e-mail é o único caminho.
    const link = `${env.FRONTEND_URL}/convite/${token.valor}`;
    await enviarEmail({
      to: email,
      subject: `Convite para a equipe ${ctx.team.name} no Taskon`,
      text: `${quemConvidou?.name ?? "Alguém"} convidou você para a equipe "${ctx.team.name}" no Taskon.\n\nAceite em: ${link}\n\nO convite expira em 7 dias.`,
      html: layoutEmail(
        `Convite para a equipe ${ctx.team.name}`,
        `<p>${escaparHtml(quemConvidou?.name ?? "Alguém")} convidou você para participar da equipe <strong>${escaparHtml(ctx.team.name)}</strong> no Taskon.</p><p>Crie sua conta para aceitar. O convite expira em 7 dias.</p>`,
        { texto: "Aceitar convite", url: link },
      ),
    });
  }

  return { convite, token: convidado ? null : token.valor };
}

// --- Leitura ---------------------------------------------------------------

export async function listarConvitesRecebidos(userId: string) {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!usuario) throw naoEncontrado("Usuário");

  return prisma.invitation.findMany({
    where: {
      status: InvitationStatus.PENDENTE,
      expiresAt: { gt: new Date() },
      OR: [{ invitedUserId: userId }, { email: usuario.email }],
    },
    orderBy: { createdAt: "desc" },
    // Só o que a tela usa: o hash do token e os ids internos ficam no banco.
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
      team: { select: { id: true, name: true, description: true } },
      invitedBy: { select: { id: true, name: true } },
    },
  });
}

export async function listarConvitesDaEquipe(userId: string, teamId: string) {
  await authorizeTeam(userId, teamId, "equipe.membros.gerenciar");

  return prisma.invitation.findMany({
    where: { teamId, status: InvitationStatus.PENDENTE },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: { select: { id: true, name: true } },
    },
  });
}

/** Dados públicos de um convite, para a tela que o link do e-mail abre. */
export async function verConvitePorToken(token: string) {
  const convite = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { team: { select: { id: true, name: true, description: true } } },
  });

  if (!convite) throw naoEncontrado("Convite");

  return {
    id: convite.id,
    email: convite.email,
    role: convite.role,
    equipe: convite.team,
    expirado: convite.expiresAt <= new Date(),
    status: convite.status,
  };
}

// --- Resposta --------------------------------------------------------------

async function carregarConviteRespondivel(userId: string, conviteId: string) {
  const [convite, usuario] = await Promise.all([
    prisma.invitation.findUnique({ where: { id: conviteId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  if (!convite || !usuario) throw naoEncontrado("Convite");

  // O convite é para um endereço específico: só quem o controla pode responder.
  const eDele =
    convite.invitedUserId === userId ||
    convite.email === normalizarEmail(usuario.email);
  if (!eDele) throw naoEncontrado("Convite");

  if (convite.status !== InvitationStatus.PENDENTE) {
    throw regraDeNegocio("Este convite já foi respondido.");
  }
  if (convite.expiresAt <= new Date()) {
    await prisma.invitation.update({
      where: { id: conviteId },
      data: { status: InvitationStatus.EXPIRADO },
    });
    throw regraDeNegocio("Este convite expirou. Peça um novo.");
  }

  return convite;
}

export async function aceitarConvite(userId: string, conviteId: string) {
  const convite = await carregarConviteRespondivel(userId, conviteId);

  if (convite.type !== InvitationType.EQUIPE || !convite.teamId) {
    throw regraDeNegocio("Tipo de convite ainda não suportado.");
  }
  const teamId = convite.teamId;

  await prisma.$transaction(async (tx) => {
    // A troca de status vem primeiro e só vale se o convite ainda estiver
    // pendente: duas respostas simultâneas não conseguem ambas passar.
    const { count } = await tx.invitation.updateMany({
      where: { id: conviteId, status: InvitationStatus.PENDENTE },
      data: {
        status: InvitationStatus.ACEITO,
        invitedUserId: userId,
        respondedAt: new Date(),
      },
    });
    if (count === 0) throw regraDeNegocio("Este convite já foi respondido.");

    const jaMembro = await tx.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!jaMembro) {
      await tx.teamMember.create({
        data: { teamId, userId, role: convite.role as TeamRole },
      });
    }

    await registrarAtividade(
      {
        entityType: "EQUIPE",
        entityId: teamId,
        actorId: userId,
        action: "MEMBRO_ADICIONADO",
        after: { userId, role: convite.role },
      },
      tx,
    );
  });

  await notificar({
    userId: convite.invitedById,
    type: "CONVITE_EQUIPE",
    payload: {
      evento: "CONVITE_ACEITO",
      conviteId,
      teamId,
      teamName: await nomeDaEquipe(teamId),
      porUserId: userId,
      porNome: await nomeDoAutor(userId),
    },
    dedupeKey: `convite-aceito:${conviteId}`,
  });

  return { teamId };
}

export async function recusarConvite(userId: string, conviteId: string) {
  const convite = await carregarConviteRespondivel(userId, conviteId);

  // Mesma guarda do aceite: só um dos dois (aceitar ou recusar) vence.
  const { count } = await prisma.invitation.updateMany({
    where: { id: conviteId, status: InvitationStatus.PENDENTE },
    data: {
      status: InvitationStatus.RECUSADO,
      invitedUserId: userId,
      respondedAt: new Date(),
    },
  });
  if (count === 0) throw regraDeNegocio("Este convite já foi respondido.");

  // Quem convidou fica sabendo: talvez queira convidar outra pessoa.
  await notificar({
    userId: convite.invitedById,
    type: "CONVITE_EQUIPE",
    payload: {
      evento: "CONVITE_RECUSADO",
      conviteId,
      teamId: convite.teamId,
      teamName: convite.teamId ? await nomeDaEquipe(convite.teamId) : null,
      porUserId: userId,
      porNome: await nomeDoAutor(userId),
    },
    dedupeKey: `convite-recusado:${conviteId}`,
  });
}

async function nomeDaEquipe(teamId: string): Promise<string | null> {
  const equipe = await prisma.team.findUnique({
    where: { id: teamId },
    select: { name: true },
  });
  return equipe?.name ?? null;
}

export async function cancelarConvite(
  userId: string,
  teamId: string,
  conviteId: string,
) {
  await authorizeTeam(userId, teamId, "equipe.membros.gerenciar");

  const convite = await prisma.invitation.findFirst({
    where: { id: conviteId, teamId },
  });
  if (!convite) throw naoEncontrado("Convite");

  await prisma.invitation.delete({ where: { id: conviteId } });
}

/**
 * Vincula convites pendentes a uma conta recém-criada.
 *
 * Quem foi convidado antes de ter conta tem o convite gravado só pelo e-mail.
 * Ao se cadastrar, os convites passam a apontar para o usuário, e assim
 * aparecem na lista dele dentro do aplicativo.
 */
export async function vincularConvitesPendentes(
  userId: string,
  email: string,
): Promise<number> {
  const { count } = await prisma.invitation.updateMany({
    where: {
      email: normalizarEmail(email),
      invitedUserId: null,
      status: InvitationStatus.PENDENTE,
    },
    data: { invitedUserId: userId },
  });
  return count;
}
