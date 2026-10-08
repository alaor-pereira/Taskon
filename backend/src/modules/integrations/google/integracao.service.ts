import { createHash, randomBytes } from "node:crypto";
import { EventKind, GoogleIntegrationStatus } from "@prisma/client";
import { dadosInvalidos, regraDeNegocio } from "../../../lib/errors.js";
import { registrarEvento } from "../../../lib/eventos-de-seguranca.js";
import { log } from "../../../lib/log.js";
import { prisma } from "../../../lib/prisma.js";
import { nomeDoAutor, notificarVarios } from "../../notifications/notifications.service.js";
import {
  ESCOPOS,
  apagarAgenda,
  cifrar,
  criarAgenda,
  emailDoIdToken,
  googleConfigurado,
  revogar,
  trocarCodigo,
  urlDeAutorizacao,
} from "./google-api.js";
import { acessoDa, marcarAgendaInicial, marcarParaSincronizar } from "./sincronizacao.js";

/**
 * Conexão com o Google Agenda: um OAuth próprio, separado do login. Qualquer
 * conta Google pode ser conectada, e conectar não cria uma forma de entrar no
 * Taskon.
 */

const PREFIXO_DO_ESTADO = "google-agenda:";
const VALIDADE_DO_ESTADO_MS = 10 * 60 * 1000;

const reunioesFuturasComMeet = (userId: string) => ({
  ownerId: userId,
  kind: EventKind.REUNIAO,
  meetLink: { not: null },
  OR: [{ endsAt: { gte: new Date() } }, { rrule: { not: null } }],
});

export async function situacaoDaIntegracao(userId: string) {
  const [integracao, reunioesComMeetFuturas] = await Promise.all([
    prisma.googleIntegration.findUnique({
      where: { userId },
      select: { googleEmail: true, status: true, lastSyncAt: true, lastError: true, consentAt: true },
    }),
    prisma.calendarEvent.count({ where: reunioesFuturasComMeet(userId) }),
  ]);
  return {
    disponivel: googleConfigurado(),
    conectada: Boolean(integracao),
    googleEmail: integracao?.googleEmail ?? null,
    status: integracao?.status ?? null,
    lastSyncAt: integracao?.lastSyncAt?.toISOString() ?? null,
    lastError: integracao?.lastError ?? null,
    reunioesComMeetFuturas,
  };
}

/**
 * Primeiro passo: com o consentimento dado no Taskon, monta o endereço do
 * Google. O `state` amarra o retorno a esta pessoa, e o PKCE garante que só
 * quem começou o fluxo consegue trocar o código.
 */
export async function iniciarConexao(userId: string): Promise<{ url: string }> {
  if (!googleConfigurado()) throw regraDeNegocio("A integração com o Google não está configurada.");

  const state = randomBytes(24).toString("base64url");
  const verificador = randomBytes(32).toString("base64url");
  const desafio = createHash("sha256").update(verificador).digest("base64url");

  await prisma.verification.create({
    data: {
      identifier: `${PREFIXO_DO_ESTADO}${state}`,
      value: JSON.stringify({ userId, verificador }),
      expiresAt: new Date(Date.now() + VALIDADE_DO_ESTADO_MS),
    },
  });

  // Quem entrou com Google vê a mesma conta já sugerida.
  const contaGoogle = await prisma.account.findFirst({
    where: { userId, providerId: "google" },
    select: { user: { select: { email: true } } },
  });

  return { url: urlDeAutorizacao({ state, desafio, loginHint: contaGoogle?.user.email }) };
}

/**
 * Retorno do Google. `sessaoUserId` é o usuário do cookie de sessão, quando o
 * navegador o mandar: se for outro, o retorno é recusado.
 */
export async function concluirConexao(
  state: string,
  codigo: string,
  sessaoUserId: string | null,
): Promise<string> {
  const registro = await prisma.verification.findFirst({
    where: { identifier: `${PREFIXO_DO_ESTADO}${state}`, expiresAt: { gt: new Date() } },
  });
  if (!registro) throw dadosInvalidos("O pedido de conexão expirou. Tente de novo.");
  // Uso único.
  await prisma.verification.delete({ where: { id: registro.id } });

  const { userId, verificador } = JSON.parse(registro.value) as { userId: string; verificador: string };
  if (sessaoUserId && sessaoUserId !== userId) throw dadosInvalidos("Conexão iniciada por outra conta.");

  const tokens = await trocarCodigo(codigo, verificador);
  const concedidos = new Set(tokens.scope.split(" "));
  // O Google deixa a pessoa desmarcar permissões na tela de consentimento.
  if (!concedidos.has(ESCOPOS[2])) {
    throw regraDeNegocio("Sem a permissão de agenda, não há como sincronizar. Conecte de novo e mantenha-a marcada.");
  }
  if (!tokens.refresh_token) throw regraDeNegocio("O Google não devolveu acesso contínuo. Tente de novo.");
  const googleEmail = emailDoIdToken(tokens.id_token);
  if (!googleEmail) throw regraDeNegocio("Não foi possível identificar a conta Google.");

  const [usuario, anterior] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } }),
    prisma.googleIntegration.findUnique({ where: { userId } }),
  ]);

  // Reconectar a mesma conta reaproveita a agenda "Taskon" que já existe lá.
  // Outra conta começa do zero: os eventos antigos estão em outra agenda.
  const mesmaConta = anterior?.googleEmail === googleEmail;
  const calendarId = mesmaConta ? anterior!.calendarId : await criarAgenda(tokens.access_token, usuario.timezone);
  if (anterior && !mesmaConta) await prisma.googleEventSync.deleteMany({ where: { userId } });

  const dados = {
    googleEmail,
    accessToken: await cifrar(tokens.access_token),
    refreshToken: await cifrar(tokens.refresh_token),
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scope: tokens.scope,
    calendarId,
    status: GoogleIntegrationStatus.ATIVA,
    consentAt: new Date(),
    lastError: null,
  };
  await prisma.googleIntegration.upsert({
    where: { userId },
    create: { userId, ...dados },
    update: dados,
  });

  registrarEvento("integracao.conectada", { userId, provedor: "google" });
  await marcarAgendaInicial(userId);
  return userId;
}

/**
 * Desconectar: tira o Meet das reuniões futuras (e avisa os participantes),
 * apaga a agenda "Taskon" no Google, revoga o acesso e esquece os tokens.
 */
export async function desconectar(userId: string) {
  const integracao = await prisma.googleIntegration.findUnique({ where: { userId } });
  if (!integracao) return;

  const comMeet = await prisma.calendarEvent.findMany({
    where: reunioesFuturasComMeet(userId),
    select: { id: true, title: true, startsAt: true, rrule: true, participants: { select: { userId: true } } },
  });
  if (comMeet.length > 0) {
    await prisma.calendarEvent.updateMany({
      where: { id: { in: comMeet.map((e) => e.id) } },
      data: { meetLink: null },
    });
    const autorNome = await nomeDoAutor(userId);
    for (const evento of comMeet) {
      await notificarVarios(
        evento.participants.map((p) => p.userId),
        {
          type: "REUNIAO_ALTERADA",
          payload: {
            eventId: evento.id,
            title: evento.title,
            startsAt: evento.startsAt.toISOString(),
            escopo: "TODAS",
            recorrente: Boolean(evento.rrule),
            ocorrencia: null,
            autorNome,
            motivo: "MEET_REMOVIDO",
          },
        },
        userId,
      );
    }
  }

  // Do lado do Google, em falha tolerada: o acesso pode já ter sido revogado
  // por lá, e isso não pode impedir a pessoa de se desconectar aqui.
  try {
    const token = await acessoDa(integracao);
    await apagarAgenda(token, integracao.calendarId);
    await revogar(token);
  } catch (erro) {
    log.warn({ err: erro, userId }, "Não foi possível limpar o Google ao desconectar");
  }

  await prisma.$transaction([
    prisma.googleEventSync.deleteMany({ where: { userId } }),
    prisma.googleIntegration.delete({ where: { userId } }),
  ]);
  registrarEvento("integracao.desconectada", { userId, provedor: "google", motivo: "pedido" });

  // Os outros participantes conectados recebem a reunião sem o link.
  for (const evento of comMeet) await marcarParaSincronizar(evento.id);
}
