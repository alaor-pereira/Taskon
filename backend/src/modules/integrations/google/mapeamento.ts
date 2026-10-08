import { EventKind, ParticipantResponse, type EventExceptionKind } from "@prisma/client";
import { env } from "../../../config/env.js";
import { paraHorarioDeParede } from "../../calendar/timezone.js";
import type { EventoGoogle } from "./google-api.js";

/**
 * Como um evento do Taskon aparece na agenda Google de uma pessoa.
 *
 * Minimização (decisão de produto e LGPD): vão título, horário, recorrência,
 * local, link do Meet, descrição e um link de volta. Nenhum nome ou e-mail de
 * participante sai do Taskon — só a contagem.
 */

export interface EventoParaSincronizar {
  id: string;
  kind: EventKind;
  title: string;
  description: string | null;
  locationOrLink: string | null;
  meetLink: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  timezone: string;
  rrule: string | null;
  totalDeParticipantes: number;
  exceptions: { originalStart: Date; kind: EventExceptionKind; overrides: unknown }[];
}

const PREFIXO_A_CONFIRMAR = "[A confirmar] ";

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Data local (AAAA-MM-DD) do instante no fuso do evento. */
function dataLocal(instante: Date, timezone: string): string {
  const h = paraHorarioDeParede(instante, timezone);
  return `${h.ano}-${doisDigitos(h.mes)}-${doisDigitos(h.dia)}`;
}

/** No Google, o fim de um evento de dia inteiro é exclusivo: o dia seguinte. */
function diaSeguinte(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function horarioNoGoogle(
  inicio: Date,
  fim: Date,
  evento: Pick<EventoParaSincronizar, "allDay" | "timezone">,
): Pick<EventoGoogle, "start" | "end"> {
  if (evento.allDay) {
    const dataFinal = dataLocal(new Date(fim.getTime() - 1), evento.timezone);
    return {
      start: { date: dataLocal(inicio, evento.timezone) },
      end: { date: diaSeguinte(dataFinal) },
    };
  }
  return {
    start: { dateTime: inicio.toISOString(), timeZone: evento.timezone },
    end: { dateTime: fim.toISOString(), timeZone: evento.timezone },
  };
}

export const linkNoTaskon = (eventId: string) => `${env.FRONTEND_URL}/?evento=${eventId}`;

export function descricaoNoGoogle(evento: EventoParaSincronizar): string {
  const partes: string[] = [];
  if (evento.description?.trim()) partes.push(evento.description.trim());
  if (evento.meetLink) partes.push(`Google Meet: ${evento.meetLink}`);
  if (evento.kind === EventKind.REUNIAO) {
    const n = evento.totalDeParticipantes;
    partes.push(n === 1 ? "Reunião com 1 participante." : `Reunião com ${n} participantes.`);
  }
  partes.push(`Abrir no Taskon: ${linkNoTaskon(evento.id)}`);
  return partes.join("\n\n");
}

/**
 * O evento-mestre como ele deve ficar na agenda de quem recebe. `resposta` é
 * a do destinatário (nula para o organizador e para atividades).
 */
export function paraGoogle(
  evento: EventoParaSincronizar,
  resposta: ParticipantResponse | null,
): EventoGoogle {
  const aConfirmar = resposta === ParticipantResponse.PENDENTE;
  return {
    summary: `${aConfirmar ? PREFIXO_A_CONFIRMAR : ""}${evento.title}`,
    description: descricaoNoGoogle(evento),
    location: evento.locationOrLink ?? null,
    ...horarioNoGoogle(evento.startsAt, evento.endsAt, evento),
    recurrence: evento.rrule ? [`RRULE:${evento.rrule}`] : null,
    source: { title: "Taskon", url: linkNoTaskon(evento.id) },
  };
}

/**
 * O que fazer com cada ocorrência alterada de uma série: cancelar ou
 * remarcar. A chave é o início original, que é como o Google identifica a
 * ocorrência.
 */
export function alteracoesDeOcorrencias(evento: EventoParaSincronizar) {
  const duracao = evento.endsAt.getTime() - evento.startsAt.getTime();
  return evento.exceptions.map((excecao) => {
    if (excecao.kind === "CANCELADA") {
      return { inicioOriginal: excecao.originalStart, mudanca: { status: "cancelled" } as EventoGoogle };
    }
    const remarcada = (excecao.overrides ?? {}) as { startsAt?: string; endsAt?: string };
    const inicio = remarcada.startsAt ? new Date(remarcada.startsAt) : excecao.originalStart;
    const fim = remarcada.endsAt ? new Date(remarcada.endsAt) : new Date(inicio.getTime() + duracao);
    return { inicioOriginal: excecao.originalStart, mudanca: horarioNoGoogle(inicio, fim, evento) };
  });
}
