import { EventKind, InvitationStatus } from "@prisma/client";
import { conflito, dadosInvalidos, naoEncontrado, regraDeNegocio } from "../../lib/errors.js";
import { registrarEvento } from "../../lib/eventos-de-seguranca.js";
import { log } from "../../lib/log.js";
import { desconectar as desconectarGoogle } from "../integrations/google/integracao.service.js";
import { enviarEmail, layoutEmail } from "../../lib/mailer.js";
import { conferirSenha } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Exclusão da própria conta (LGPD, art. 18, VI).
 *
 * A linha do usuário não é apagada: ela é anonimizada. Comentários, tarefas
 * criadas em projetos de outras pessoas, reuniões com outros participantes e o
 * histórico continuam existindo, agora assinados por "Usuário removido". O que
 * é só dele — Caixa de entrada, projetos pessoais, atividades, notificações,
 * preferências, foto, sessões e credenciais — some de vez.
 *
 * O registro de aceite dos termos fica, como prova de cumprimento de
 * obrigação legal (art. 16, I).
 */

export const NOME_ANONIMO = "Usuário removido";

/** Quem entra só pelo Google/GitHub não tem senha: vale a sessão recente. */
export const JANELA_DE_SESSAO_RECENTE_MS = 24 * 60 * 60 * 1000;

const emailAnonimo = (userId: string) => `removido-${userId}@taskon.invalid`;

/**
 * O que impede a exclusão: equipes de que é dono e projetos ativos que
 * envolvem outras pessoas (com outros membros ou dentro de uma equipe). Esses
 * precisam ser transferidos ou excluídos antes, senão ficariam sem dono.
 */
export async function bloqueiosDaExclusao(userId: string) {
  const [equipes, projetos] = await Promise.all([
    prisma.team.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: {
        ownerId: userId,
        isInbox: false,
        deletedAt: null,
        OR: [{ teamId: { not: null } }, { members: { some: { userId: { not: userId } } } }],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    equipes: equipes.map((e) => ({ id: e.id, nome: e.name })),
    projetos: projetos.map((p) => ({ id: p.id, nome: p.name })),
  };
}

/** Situação mostrada no diálogo antes de pedir a confirmação. */
export async function preparacaoDaExclusao(userId: string, sessaoCriadaEm: Date) {
  const [bloqueios, credencial] = await Promise.all([
    bloqueiosDaExclusao(userId),
    prisma.account.findFirst({
      where: { userId, providerId: "credential", password: { not: null } },
      select: { id: true },
    }),
  ]);
  return {
    ...bloqueios,
    temSenha: Boolean(credencial),
    sessaoRecente: Date.now() - sessaoCriadaEm.getTime() < JANELA_DE_SESSAO_RECENTE_MS,
  };
}

export interface ConfirmacaoDeExclusao {
  email: string;
  senha?: string;
  sessaoCriadaEm: Date;
}

export async function excluirConta(userId: string, confirmacao: ConfirmacaoDeExclusao) {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, anonymizedAt: true },
  });
  if (!usuario || usuario.anonymizedAt) throw naoEncontrado("Usuário");

  if (confirmacao.email.trim().toLowerCase() !== usuario.email.toLowerCase()) {
    throw dadosInvalidos("O e-mail digitado não confere com o da sua conta.");
  }

  const credencial = await prisma.account.findFirst({
    where: { userId, providerId: "credential", password: { not: null } },
    select: { password: true },
  });
  if (credencial?.password) {
    const confere =
      Boolean(confirmacao.senha) && (await conferirSenha(credencial.password, confirmacao.senha!));
    if (!confere) throw dadosInvalidos("Senha incorreta.");
  } else if (Date.now() - confirmacao.sessaoCriadaEm.getTime() >= JANELA_DE_SESSAO_RECENTE_MS) {
    throw regraDeNegocio("Por segurança, saia e entre de novo antes de excluir a conta.", {
      motivo: "REAUTENTICAR",
    });
  }

  const bloqueios = await bloqueiosDaExclusao(userId);
  if (bloqueios.equipes.length > 0 || bloqueios.projetos.length > 0) {
    throw conflito(
      "Transfira ou exclua as equipes e os projetos compartilhados de que você é dono antes de excluir a conta.",
      bloqueios,
    );
  }

  // A agenda "Taskon" no Google e o acesso a ela saem primeiro: depois da
  // anonimização, não haveria mais como chegar lá.
  await desconectarGoogle(userId);

  // O aviso sai antes, enquanto ainda existe um endereço para onde mandar.
  // Uma falha de envio não pode impedir o titular de exercer o direito.
  await enviarEmail({
    to: usuario.email,
    subject: "Sua conta no Taskon foi excluída",
    text:
      "Sua conta no Taskon foi excluída a seu pedido. Seus dados pessoais foram apagados; " +
      "comentários e o histórico de projetos compartilhados permanecem, sem identificar você.",
    html: layoutEmail(
      "Sua conta foi excluída",
      "<p>Atendemos ao seu pedido: sua conta no Taskon foi excluída e seus dados pessoais foram apagados.</p>" +
        "<p>Comentários e o histórico de projetos compartilhados com outras pessoas permanecem, assinados como “Usuário removido”.</p>" +
        "<p>Se não foi você quem pediu, fale conosco pelo contato indicado na Política de privacidade.</p>",
    ),
  }).catch((erro: unknown) => {
    log.error({ err: erro, userId }, "Falha ao enviar o aviso de exclusão de conta");
  });

  await prisma.$transaction(async (tx) => {
    // Projetos só dele: Caixa de entrada e pessoais sem mais ninguém, inclusive
    // os que estão na lixeira. A exclusão leva tarefas, comentários e histórico.
    await tx.project.deleteMany({
      where: {
        ownerId: userId,
        teamId: null,
        members: { none: { userId: { not: userId } } },
      },
    });

    // Atividades são pessoais; reuniões só somem se não envolverem mais ninguém.
    await tx.calendarEvent.deleteMany({
      where: {
        ownerId: userId,
        OR: [
          { kind: EventKind.ATIVIDADE },
          { kind: EventKind.REUNIAO, participants: { none: { userId: { not: userId } } } },
        ],
      },
    });

    await tx.eventParticipant.deleteMany({ where: { userId } });
    await tx.taskAssignee.deleteMany({ where: { userId } });
    await tx.commentMention.deleteMany({ where: { userId } });
    await tx.teamMember.deleteMany({ where: { userId } });
    await tx.projectMember.deleteMany({ where: { userId } });

    await tx.notification.deleteMany({ where: { userId } });
    await tx.notificationPreference.deleteMany({ where: { userId } });
    await tx.userViewPreference.deleteMany({ where: { userId } });
    await tx.userPageViewPreference.deleteMany({ where: { userId } });
    await tx.userAvatar.deleteMany({ where: { userId } });

    // Convites em aberto perdem o sentido; os já respondidos guardam o e-mail
    // de quem foi convidado, que deixa de ser o dele.
    await tx.invitation.deleteMany({
      where: {
        status: InvitationStatus.PENDENTE,
        OR: [{ invitedById: userId }, { invitedUserId: userId }, { email: usuario.email }],
      },
    });
    await tx.invitation.updateMany({
      where: { email: usuario.email },
      data: { email: emailAnonimo(userId) },
    });

    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.twoFactor.deleteMany({ where: { userId } });
    await tx.verification.deleteMany({
      where: { OR: [{ identifier: usuario.email }, { value: userId }] },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        name: NOME_ANONIMO,
        email: emailAnonimo(userId),
        emailVerified: false,
        image: null,
        anonymizedAt: new Date(),
        twoFactorEnabled: false,
      },
    });
  });

  // Só o id: o e-mail e o nome já não existem, e não devem reaparecer no log.
  registrarEvento("conta.excluida", { userId });
}
