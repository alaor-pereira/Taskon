import { EventKind, ParticipantResponse } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  agendaDoPeriodo,
  atividadesDeHoje,
  atualizarEvento,
  convidaveis,
  criarEvento,
  excluirEvento,
  obterEvento,
  proximasAtividades,
  responderReuniao,
  reunioesAgendadas,
} from "../../modules/calendar/calendar.service.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";

const idDoEvento = z.object({ eventId: z.string().uuid() });

/** Maior janela do calendário: um ano e pouco cobre todas as visualizações. */
const JANELA_MAXIMA_MS = 400 * 24 * 60 * 60 * 1000;

const recorrencia = z.object({
  frequencia: z.enum(["DIARIA", "SEMANAL", "MENSAL", "ANUAL"]),
  intervalo: z.number().int().min(1).max(366).optional(),
  /** 0 = domingo … 6 = sábado. */
  diasDaSemana: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  termino: z
    .discriminatedUnion("tipo", [
      z.object({ tipo: z.literal("NUNCA") }),
      z.object({ tipo: z.literal("ATE"), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
      z.object({
        tipo: z.literal("APOS"),
        ocorrencias: z.number().int().min(1).max(1000),
      }),
    ])
    .optional(),
});

const escopo = z.enum(["SO_ESTA", "ESTA_E_SEGUINTES", "TODAS"]);

export async function rotasDeAgenda(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirAutenticacao);

  // --- Seções da barra lateral ---------------------------------------------

  app.get("/hoje", async (request) => {
    const usuario = usuarioDe(request);
    // "Hoje" é resolvido pelo fuso do perfil, no servidor.
    return atividadesDeHoje(usuario.id, usuario.timezone);
  });

  app.get("/proximas", async (request) => {
    const usuario = usuarioDe(request);
    return proximasAtividades(usuario.id, usuario.timezone);
  });

  app.get("/reunioes", async (request) => {
    return reunioesAgendadas(usuarioDe(request).id);
  });

  app.get("/convidaveis", async (request) => {
    return convidaveis(usuarioDe(request).id);
  });

  /** Intervalo livre, para a visualização de calendário. */
  app.get("/periodo", async (request) => {
    const { inicio, fim, kind } = z
      .object({
        inicio: z.string().datetime(),
        fim: z.string().datetime(),
        kind: z.nativeEnum(EventKind).optional(),
      })
      // A recorrência é expandida para a janela inteira antes de qualquer
      // corte: sem teto, um intervalo de séculos travaria o servidor.
      .refine((q) => Date.parse(q.fim) > Date.parse(q.inicio), {
        message: "O fim precisa ser depois do início.",
        path: ["fim"],
      })
      .refine((q) => Date.parse(q.fim) - Date.parse(q.inicio) <= JANELA_MAXIMA_MS, {
        message: "O intervalo pode ter no máximo 400 dias.",
        path: ["fim"],
      })
      .parse(request.query);

    return agendaDoPeriodo(
      usuarioDe(request).id,
      new Date(inicio),
      new Date(fim),
      kind,
    );
  });

  // --- Evento --------------------------------------------------------------

  app.get("/:eventId", async (request) => {
    const { eventId } = idDoEvento.parse(request.params);
    return obterEvento(usuarioDe(request).id, eventId);
  });

  app.post("/", async (request, reply) => {
    const corpo = z
      .object({
        kind: z.nativeEnum(EventKind),
        title: z.string().trim().min(1).max(300),
        description: z.string().trim().max(5000).nullable().optional(),
        locationOrLink: z.string().trim().max(500).nullable().optional(),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
        allDay: z.boolean().optional(),
        timezone: z.string().min(1).max(100),
        recorrencia: recorrencia.nullable().optional(),
        taskId: z.string().uuid().nullable().optional(),
        projectId: z.string().uuid().nullable().optional(),
        participantIds: z.array(z.string().uuid()).max(100).optional(),
        meet: z.boolean().optional(),
      })
      .parse(request.body);

    const evento = await criarEvento(usuarioDe(request).id, corpo);
    return reply.status(201).send(evento);
  });

  app.patch("/:eventId", async (request) => {
    const { eventId } = idDoEvento.parse(request.params);
    const corpo = z
      .object({
        title: z.string().trim().min(1).max(300).optional(),
        description: z.string().trim().max(5000).nullable().optional(),
        locationOrLink: z.string().trim().max(500).nullable().optional(),
        startsAt: z.string().datetime().optional(),
        endsAt: z.string().datetime().optional(),
        recorrencia: recorrencia.nullable().optional(),
        /** Ocorrência afetada, obrigatória fora de "TODAS". */
        ocorrencia: z.string().datetime().optional(),
        escopo: escopo.optional(),
        meet: z.boolean().optional(),
      })
      .parse(request.body);

    return atualizarEvento(usuarioDe(request).id, eventId, corpo);
  });

  app.delete("/:eventId", async (request) => {
    const { eventId } = idDoEvento.parse(request.params);
    const query = z
      .object({
        escopo: escopo.optional(),
        ocorrencia: z.string().datetime().optional(),
      })
      .parse(request.query);

    return excluirEvento(usuarioDe(request).id, eventId, query);
  });

  app.post("/:eventId/resposta", async (request) => {
    const { eventId } = idDoEvento.parse(request.params);
    const { resposta } = z
      .object({ resposta: z.nativeEnum(ParticipantResponse) })
      .parse(request.body);

    return responderReuniao(usuarioDe(request).id, eventId, resposta);
  });
}
