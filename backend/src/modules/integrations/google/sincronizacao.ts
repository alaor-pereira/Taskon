import {
  EventKind,
  GoogleIntegrationStatus,
  GoogleSyncStatus,
  ParticipantResponse,
  type GoogleIntegration,
} from "@prisma/client";
import { isTest } from "../../../config/env.js";
import { registrarEvento } from "../../../lib/eventos-de-seguranca.js";
import { log } from "../../../lib/log.js";
import { prisma } from "../../../lib/prisma.js";
import { notificar } from "../../notifications/notifications.service.js";
import {
  ErroDoGoogle,
  apagarEvento,
  atualizarEvento,
  idDaOcorrencia,
  inserirEvento,
  tokenDeAcesso,
} from "./google-api.js";
import { alteracoesDeOcorrencias, paraGoogle, type EventoParaSincronizar } from "./mapeamento.js";

/**
 * Sincronização Taskon → Google.
 *
 * Toda mudança na agenda marca linhas em `GoogleEventSync` (uma por evento e
 * por pessoa conectada) e dispara o processamento sem segurar a resposta. O
 * que falhar fica pendente e o cron tenta de novo. Salvar no Taskon nunca
 * depende do Google estar no ar.
 */

export const MAXIMO_DE_TENTATIVAS = 8;

// --- Quem recebe -------------------------------------------------------------

/**
 * Pessoas conectadas que devem ter o evento na agenda Google: o dono, e numa
 * reunião também os participantes que não recusaram.
 */
export async function destinatarios(eventId: string) {
  const evento = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: {
      kind: true,
      ownerId: true,
      participants: { select: { userId: true, response: true } },
    },
  });
  if (!evento) return [];

  const candidatos = new Map<string, ParticipantResponse | null>([[evento.ownerId, null]]);
  if (evento.kind === EventKind.REUNIAO) {
    for (const p of evento.participants) {
      if (p.userId === evento.ownerId) continue;
      if (p.response === ParticipantResponse.RECUSADO) continue;
      candidatos.set(p.userId, p.response);
    }
  }

  const conectados = await prisma.googleIntegration.findMany({
    where: { userId: { in: [...candidatos.keys()] }, status: GoogleIntegrationStatus.ATIVA },
    select: { userId: true },
  });
  return conectados.map(({ userId }) => ({ userId, resposta: candidatos.get(userId) ?? null }));
}

// --- Fila ----------------------------------------------------------------------

/**
 * Marca o que precisa mudar no Google por causa deste evento. Chamado depois
 * de criar, editar, responder e — antes de apagar a linha — excluir.
 */
export async function marcarParaSincronizar(
  eventId: string,
  opcoes: { excluido?: boolean } = {},
): Promise<void> {
  const [devem, existentes] = await Promise.all([
    opcoes.excluido ? Promise.resolve([]) : destinatarios(eventId),
    prisma.googleEventSync.findMany({ where: { eventId }, select: { id: true, userId: true, googleEventId: true } }),
  ]);
  if (devem.length === 0 && existentes.length === 0) return;

  const quemDeve = new Set(devem.map((d) => d.userId));
  const ids: string[] = [];

  for (const { userId } of devem) {
    const linha = await prisma.googleEventSync.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId },
      update: { status: GoogleSyncStatus.PENDENTE, tentativas: 0, lastError: null },
      select: { id: true },
    });
    ids.push(linha.id);
  }

  for (const linha of existentes) {
    if (quemDeve.has(linha.userId)) continue;
    if (!linha.googleEventId) {
      // Nunca chegou ao Google: não há o que apagar lá.
      await prisma.googleEventSync.delete({ where: { id: linha.id } });
      continue;
    }
    await prisma.googleEventSync.update({
      where: { id: linha.id },
      data: { status: GoogleSyncStatus.REMOVER, tentativas: 0, lastError: null },
    });
    ids.push(linha.id);
  }

  agendarProcessamento(ids);
}

/** Processa já, sem segurar a resposta. Nos testes, quem processa é o teste. */
function agendarProcessamento(ids: string[]) {
  if (isTest || ids.length === 0) return;
  setImmediate(() => {
    processarSincronizacoes(ids).catch((erro) =>
      log.error({ err: erro }, "Falha ao sincronizar com o Google Agenda"),
    );
  });
}

// --- Processamento -------------------------------------------------------------

async function carregarParaSincronizar(eventId: string): Promise<EventoParaSincronizar | null> {
  const evento = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      kind: true,
      title: true,
      description: true,
      locationOrLink: true,
      meetLink: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      timezone: true,
      rrule: true,
      exceptions: { select: { originalStart: true, kind: true, overrides: true } },
      _count: { select: { participants: true } },
    },
  });
  if (!evento) return null;
  const { _count, ...resto } = evento;
  return { ...resto, totalDeParticipantes: _count.participants };
}

async function respostaDe(userId: string, eventId: string) {
  const p = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { response: true },
  });
  return p?.response ?? null;
}

/**
 * Token de acesso da integração, persistindo a renovação. Se o Google não
 * aceitar mais as credenciais, a integração passa a "precisa reconectar".
 */
export async function acessoDa(integracao: GoogleIntegration): Promise<string> {
  try {
    const { token, novo } = await tokenDeAcesso(integracao);
    if (novo) await prisma.googleIntegration.update({ where: { id: integracao.id }, data: novo });
    return token;
  } catch (erro) {
    if (erro instanceof ErroDoGoogle && erro.acessoPerdido) await marcarDesconectada(integracao, erro.message);
    throw erro;
  }
}

export async function marcarDesconectada(integracao: GoogleIntegration, motivo: string) {
  if (integracao.status === GoogleIntegrationStatus.PRECISA_RECONECTAR) return;
  await prisma.googleIntegration.update({
    where: { id: integracao.id },
    data: { status: GoogleIntegrationStatus.PRECISA_RECONECTAR, lastError: motivo.slice(0, 500) },
  });
  registrarEvento("integracao.desconectada", { userId: integracao.userId, motivo: "acesso_perdido" });
  await notificar({
    userId: integracao.userId,
    type: "INTEGRACAO_DESCONECTADA",
    payload: { provedor: "google", googleEmail: integracao.googleEmail },
    // Um aviso por conexão: reconectar grava um novo consentAt.
    dedupeKey: `google-desconectada:${integracao.id}:${integracao.consentAt.getTime()}`,
  });
}

/** Envia para o Google o estado atual do evento (mestre + ocorrências alteradas). */
async function enviarEvento(
  token: string,
  integracao: GoogleIntegration,
  linha: { id: string; userId: string; eventId: string; googleEventId: string | null },
) {
  const evento = await carregarParaSincronizar(linha.eventId);
  if (!evento) return null;

  const corpo = paraGoogle(evento, await respostaDe(linha.userId, evento.id));
  const salvo = linha.googleEventId
    ? await atualizarEvento(token, integracao.calendarId, linha.googleEventId, corpo)
    : await inserirEvento(token, integracao.calendarId, corpo);

  if (evento.rrule) {
    for (const { inicioOriginal, mudanca } of alteracoesDeOcorrencias(evento)) {
      const id = idDaOcorrencia(salvo.id, inicioOriginal, evento.allDay);
      try {
        await atualizarEvento(token, integracao.calendarId, id, mudanca);
      } catch (erro) {
        // A ocorrência pode não existir mais (a série foi encurtada).
        if (!(erro instanceof ErroDoGoogle && (erro.status === 404 || erro.status === 410))) throw erro;
      }
    }
  }
  return salvo.id;
}

/**
 * Processa linhas da fila. Sem `ids`, pega as pendentes cuja espera (que
 * dobra a cada tentativa) já passou — é o caminho do cron.
 */
export async function processarSincronizacoes(ids?: string[], limite = 200) {
  const candidatas = await prisma.googleEventSync.findMany({
    where: {
      status: { in: [GoogleSyncStatus.PENDENTE, GoogleSyncStatus.REMOVER] },
      ...(ids && { id: { in: ids } }),
    },
    orderBy: { updatedAt: "asc" },
    take: limite,
  });
  const agora = Date.now();
  const linhas = ids
    ? candidatas
    : candidatas.filter((l) => l.tentativas === 0 || agora - l.updatedAt.getTime() >= 2 ** l.tentativas * 60_000);

  const resultado = { sincronizados: 0, removidos: 0, falhas: 0 };
  const porPessoa = new Map<string, typeof linhas>();
  for (const linha of linhas) porPessoa.set(linha.userId, [...(porPessoa.get(linha.userId) ?? []), linha]);

  for (const [userId, daPessoa] of porPessoa) {
    const integracao = await prisma.googleIntegration.findUnique({ where: { userId } });
    if (!integracao) {
      await prisma.googleEventSync.deleteMany({ where: { userId } });
      continue;
    }
    if (integracao.status !== GoogleIntegrationStatus.ATIVA) continue;

    let token: string;
    try {
      token = await acessoDa(integracao);
    } catch {
      resultado.falhas += daPessoa.length;
      continue;
    }

    let ultimoErro: string | null = null;
    for (const linha of daPessoa) {
      try {
        if (linha.status === GoogleSyncStatus.REMOVER || !linha.eventId) {
          if (linha.googleEventId) await apagarEvento(token, integracao.calendarId, linha.googleEventId);
          await prisma.googleEventSync.delete({ where: { id: linha.id } });
          resultado.removidos++;
          continue;
        }
        const googleEventId = await enviarEvento(token, integracao, { ...linha, eventId: linha.eventId });
        if (!googleEventId) {
          await prisma.googleEventSync.delete({ where: { id: linha.id } });
          continue;
        }
        await prisma.googleEventSync.update({
          where: { id: linha.id },
          data: { googleEventId, status: GoogleSyncStatus.SINCRONIZADO, tentativas: 0, lastError: null },
        });
        resultado.sincronizados++;
      } catch (erro) {
        resultado.falhas++;
        ultimoErro = (erro as Error).message.slice(0, 500);
        if (erro instanceof ErroDoGoogle && erro.acessoPerdido) {
          await marcarDesconectada(integracao, erro.message);
          break;
        }
        const tentativas = linha.tentativas + 1;
        await prisma.googleEventSync.update({
          where: { id: linha.id },
          data: {
            tentativas,
            lastError: ultimoErro,
            ...(tentativas >= MAXIMO_DE_TENTATIVAS && { status: GoogleSyncStatus.ERRO }),
          },
        });
        registrarEvento("integracao.falha", { userId, tentativas });
      }
    }

    await prisma.googleIntegration.update({
      where: { id: integracao.id },
      data: { lastSyncAt: new Date(), lastError: ultimoErro },
    });
  }

  return resultado;
}

/** Cron: tenta de novo o que ficou pendente. */
export function sincronizarGoogle() {
  return processarSincronizacoes();
}

/**
 * Ao conectar: tudo o que a pessoa vê de hoje em diante (séries recorrentes
 * inteiras) entra na fila.
 */
export async function marcarAgendaInicial(userId: string) {
  const inicioDeHoje = new Date();
  inicioDeHoje.setUTCHours(0, 0, 0, 0);

  const eventos = await prisma.calendarEvent.findMany({
    where: {
      AND: [
        { OR: [{ endsAt: { gte: inicioDeHoje } }, { rrule: { not: null } }] },
        {
          OR: [
            { ownerId: userId },
            {
              kind: EventKind.REUNIAO,
              participants: { some: { userId, response: { not: ParticipantResponse.RECUSADO } } },
            },
          ],
        },
      ],
    },
    select: { id: true },
  });

  const ids: string[] = [];
  for (const { id } of eventos) {
    const linha = await prisma.googleEventSync.upsert({
      where: { userId_eventId: { userId, eventId: id } },
      create: { userId, eventId: id },
      update: { status: GoogleSyncStatus.PENDENTE, tentativas: 0, lastError: null },
      select: { id: true },
    });
    ids.push(linha.id);
  }
  agendarProcessamento(ids);
  return ids.length;
}
