import { randomUUID } from "node:crypto";
import { EventKind, GoogleIntegrationStatus, GoogleSyncStatus } from "@prisma/client";
import { log } from "../../../lib/log.js";
import { prisma } from "../../../lib/prisma.js";
import { atualizarEvento, inserirEvento } from "./google-api.js";
import { paraGoogle } from "./mapeamento.js";
import { acessoDa } from "./sincronizacao.js";

/**
 * Link do Google Meet de uma reunião.
 *
 * O Meet nasce como a conferência do evento na agenda Google do organizador —
 * por isso só quem organiza, e só com a integração ativa, pode gerar. O link
 * é guardado no evento e mostrado a todos os participantes.
 *
 * Nunca impede salvar a reunião: se o Google falhar, devolve um aviso.
 */

export const AVISO_SEM_INTEGRACAO =
  "Conecte o Google Agenda para gerar links do Google Meet.";
export const AVISO_FALHA_NO_MEET = "Não foi possível gerar o link do Meet agora. Tente de novo mais tarde.";

export async function definirMeet(
  userId: string,
  eventId: string,
  querMeet: boolean,
): Promise<string | null> {
  const evento = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      kind: true,
      ownerId: true,
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
  if (!evento || evento.kind !== EventKind.REUNIAO || evento.ownerId !== userId) return null;
  if (querMeet === Boolean(evento.meetLink)) return null;

  const integracao = await prisma.googleIntegration.findUnique({ where: { userId } });
  if (!integracao || integracao.status !== GoogleIntegrationStatus.ATIVA) {
    return querMeet ? AVISO_SEM_INTEGRACAO : await limparMeet(eventId);
  }

  const linha = await prisma.googleEventSync.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  try {
    const token = await acessoDa(integracao);

    if (!querMeet) {
      if (linha?.googleEventId) {
        await atualizarEvento(token, integracao.calendarId, linha.googleEventId, { conferenceData: null }, true);
      }
      return await limparMeet(eventId);
    }

    const { _count, ...resto } = evento;
    const corpo = {
      ...paraGoogle({ ...resto, totalDeParticipantes: _count.participants }, null),
      conferenceData: {
        createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } },
      },
    };
    const salvo = linha?.googleEventId
      ? await atualizarEvento(token, integracao.calendarId, linha.googleEventId, corpo, true)
      : await inserirEvento(token, integracao.calendarId, corpo, true);

    await prisma.googleEventSync.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId, googleEventId: salvo.id, status: GoogleSyncStatus.SINCRONIZADO },
      update: { googleEventId: salvo.id },
    });

    if (!salvo.hangoutLink) return AVISO_FALHA_NO_MEET;
    await prisma.calendarEvent.update({ where: { id: eventId }, data: { meetLink: salvo.hangoutLink } });
    return null;
  } catch (erro) {
    log.warn({ err: erro, eventId }, "Falha ao gerar ou remover o Google Meet");
    return querMeet ? AVISO_FALHA_NO_MEET : await limparMeet(eventId);
  }
}

async function limparMeet(eventId: string): Promise<null> {
  await prisma.calendarEvent.update({ where: { id: eventId }, data: { meetLink: null } });
  return null;
}
