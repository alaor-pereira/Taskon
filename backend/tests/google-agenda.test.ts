import { EventKind, GoogleSyncStatus, ParticipantResponse } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { criarEvento, excluirEvento, responderReuniao } from "../src/modules/calendar/calendar.service.js";
import { cifrar, idDaOcorrencia } from "../src/modules/integrations/google/google-api.js";
import {
  concluirConexao,
  desconectar,
  iniciarConexao,
} from "../src/modules/integrations/google/integracao.service.js";
import { AVISO_FALHA_NO_MEET, AVISO_SEM_INTEGRACAO } from "../src/modules/integrations/google/meet.js";
import { alteracoesDeOcorrencias, paraGoogle } from "../src/modules/integrations/google/mapeamento.js";
import { processarSincronizacoes } from "../src/modules/integrations/google/sincronizacao.js";
import { colegasDeEquipe, criarUsuario, limparBanco } from "./factories.js";

beforeEach(limparBanco);
afterEach(() => vi.restoreAllMocks());

const SP = "America/Sao_Paulo";

/** Simula a API do Google: cada chamada é registrada e respondida por `responder`. */
function simularGoogle(responder: (url: string, init: RequestInit) => { status?: number; corpo?: unknown } = () => ({})) {
  const chamadas: { url: string; metodo: string; corpo: Record<string, unknown> | null }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (entrada, init = {}) => {
    const url = String(entrada);
    const corpo = typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    chamadas.push({ url, metodo: init.method ?? "GET", corpo });
    const { status = 200, corpo: resposta = { id: `g-${chamadas.length}` } } = responder(url, init);
    return new Response(status === 204 ? null : JSON.stringify(resposta), { status });
  });
  return chamadas;
}

async function conectar(userId: string, email = "pessoa@gmail.com") {
  return prisma.googleIntegration.create({
    data: {
      userId,
      googleEmail: email,
      accessToken: await cifrar("token-de-acesso"),
      refreshToken: await cifrar("token-de-renovacao"),
      accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      scope: "openid email https://www.googleapis.com/auth/calendar.app.created",
      calendarId: "agenda-taskon@group.calendar.google.com",
      consentAt: new Date(),
    },
  });
}

const reuniao = (participantIds: string[], extras: Record<string, unknown> = {}) => ({
  kind: EventKind.REUNIAO,
  title: "Planejamento",
  description: "Pauta da semana",
  startsAt: "2030-03-04T17:00:00.000Z",
  endsAt: "2030-03-04T18:00:00.000Z",
  timezone: SP,
  participantIds,
  ...extras,
});

describe("como o evento aparece no Google", () => {
  const base = {
    id: "evento-1",
    kind: EventKind.REUNIAO,
    title: "Planejamento",
    description: "Pauta",
    locationOrLink: "Sala 2",
    meetLink: "https://meet.google.com/abc-defg-hij",
    startsAt: new Date("2030-03-04T17:00:00.000Z"),
    endsAt: new Date("2030-03-04T18:00:00.000Z"),
    allDay: false,
    timezone: SP,
    rrule: "FREQ=WEEKLY;BYDAY=MO",
    totalDeParticipantes: 3,
    exceptions: [],
  };

  it("leva horário com fuso, recorrência, Meet e link de volta, sem participantes", () => {
    const g = paraGoogle(base, null);
    expect(g.summary).toBe("Planejamento");
    expect(g.start).toEqual({ dateTime: "2030-03-04T17:00:00.000Z", timeZone: SP });
    expect(g.recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO"]);
    expect(g.location).toBe("Sala 2");
    expect(g.description).toContain("Google Meet: https://meet.google.com/abc-defg-hij");
    expect(g.description).toContain("Reunião com 3 participantes.");
    expect(g.description).toContain("/?evento=evento-1");
  });

  it("marca como a confirmar para quem ainda não respondeu", () => {
    expect(paraGoogle(base, ParticipantResponse.PENDENTE).summary).toBe("[A confirmar] Planejamento");
    expect(paraGoogle(base, ParticipantResponse.ACEITO).summary).toBe("Planejamento");
  });

  it("dia inteiro usa datas, com o fim exclusivo", () => {
    const g = paraGoogle(
      {
        ...base,
        allDay: true,
        startsAt: new Date("2030-03-04T03:00:00.000Z"),
        endsAt: new Date("2030-03-05T03:00:00.000Z"),
      },
      null,
    );
    expect(g.start).toEqual({ date: "2030-03-04" });
    expect(g.end).toEqual({ date: "2030-03-05" });
  });

  it("ocorrências canceladas e remarcadas viram alterações de instância", () => {
    const original = new Date("2030-03-11T17:00:00.000Z");
    const alteracoes = alteracoesDeOcorrencias({
      ...base,
      exceptions: [
        { originalStart: original, kind: "CANCELADA", overrides: null },
        {
          originalStart: new Date("2030-03-18T17:00:00.000Z"),
          kind: "MODIFICADA",
          overrides: { startsAt: "2030-03-18T19:00:00.000Z", endsAt: "2030-03-18T20:00:00.000Z" },
        },
      ],
    });
    expect(alteracoes[0]?.mudanca).toEqual({ status: "cancelled" });
    expect(alteracoes[1]?.mudanca.start?.dateTime).toBe("2030-03-18T19:00:00.000Z");
    expect(idDaOcorrencia("abc", original, false)).toBe("abc_20300311T170000Z");
  });
});

describe("quem recebe na agenda Google", () => {
  it("só quem conectou; quem recusou sai", async () => {
    const organizador = await criarUsuario();
    const aceita = await criarUsuario();
    const semGoogle = await criarUsuario();
    await colegasDeEquipe(organizador.id, aceita.id, semGoogle.id);
    await conectar(organizador.id, "org@gmail.com");
    await conectar(aceita.id, "aceita@gmail.com");

    const evento = await criarEvento(organizador.id, reuniao([aceita.id, semGoogle.id]));
    const linhas = await prisma.googleEventSync.findMany({ where: { eventId: evento.id } });
    expect(linhas.map((l) => l.userId).sort()).toEqual([organizador.id, aceita.id].sort());
    expect(linhas.every((l) => l.status === GoogleSyncStatus.PENDENTE)).toBe(true);

    // Já sincronizada, a cópia de quem recusa passa a ser removida.
    await prisma.googleEventSync.updateMany({
      where: { eventId: evento.id },
      data: { status: GoogleSyncStatus.SINCRONIZADO, googleEventId: "g-x" },
    });
    await responderReuniao(aceita.id, evento.id, ParticipantResponse.RECUSADO);
    const daQueRecusou = await prisma.googleEventSync.findUniqueOrThrow({
      where: { userId_eventId: { userId: aceita.id, eventId: evento.id } },
    });
    expect(daQueRecusou.status).toBe(GoogleSyncStatus.REMOVER);
  });

  it("atividade vai só para o dono", async () => {
    const dono = await criarUsuario();
    await conectar(dono.id);
    const evento = await criarEvento(dono.id, {
      kind: EventKind.ATIVIDADE,
      title: "Dentista",
      startsAt: "2030-03-04T12:00:00.000Z",
      endsAt: "2030-03-04T13:00:00.000Z",
      timezone: SP,
    });
    expect(await prisma.googleEventSync.count({ where: { eventId: evento.id } })).toBe(1);
  });
});

describe("processamento", () => {
  it("cria no Google sem nomes nem e-mails de participantes e guarda o id", async () => {
    const organizador = await criarUsuario("Ana Organizadora");
    const convidado = await criarUsuario("Bruno Convidado");
    await colegasDeEquipe(organizador.id, convidado.id);
    await conectar(organizador.id);
    const evento = await criarEvento(organizador.id, reuniao([convidado.id]));

    const chamadas = simularGoogle(() => ({ corpo: { id: "google-123" } }));
    await processarSincronizacoes();

    const envio = chamadas.find((c) => c.metodo === "POST" && c.url.includes("/events"));
    expect(envio).toBeDefined();
    const texto = JSON.stringify(envio!.corpo);
    expect(texto).not.toContain("Bruno");
    expect(texto).not.toContain(convidado.email);
    const linha = await prisma.googleEventSync.findFirstOrThrow({ where: { eventId: evento.id } });
    expect(linha).toMatchObject({ status: GoogleSyncStatus.SINCRONIZADO, googleEventId: "google-123" });
  });

  it("excluir a reunião apaga a cópia no Google", async () => {
    const dono = await criarUsuario();
    await conectar(dono.id);
    const evento = await criarEvento(dono.id, reuniao([]));
    await prisma.googleEventSync.updateMany({
      where: { eventId: evento.id },
      data: { status: GoogleSyncStatus.SINCRONIZADO, googleEventId: "google-9" },
    });

    await excluirEvento(dono.id, evento.id);
    const chamadas = simularGoogle(() => ({ status: 204 }));
    await processarSincronizacoes();

    expect(chamadas.some((c) => c.metodo === "DELETE" && c.url.endsWith("/events/google-9"))).toBe(true);
    expect(await prisma.googleEventSync.count({ where: { userId: dono.id } })).toBe(0);
  });

  it("falha passageira conta tentativa; acesso revogado pede reconexão e avisa", async () => {
    const dono = await criarUsuario();
    await conectar(dono.id);
    await criarEvento(dono.id, reuniao([]));

    simularGoogle(() => ({ status: 503, corpo: { error: { message: "Indisponível" } } }));
    await processarSincronizacoes();
    const linha = await prisma.googleEventSync.findFirstOrThrow({ where: { userId: dono.id } });
    expect(linha).toMatchObject({ status: GoogleSyncStatus.PENDENTE, tentativas: 1 });

    simularGoogle(() => ({ status: 401, corpo: { error: { message: "Invalid Credentials" } } }));
    await processarSincronizacoes([linha.id]);
    const integracao = await prisma.googleIntegration.findUniqueOrThrow({ where: { userId: dono.id } });
    expect(integracao.status).toBe("PRECISA_RECONECTAR");
    expect(
      await prisma.notification.count({ where: { userId: dono.id, type: "INTEGRACAO_DESCONECTADA" } }),
    ).toBe(1);
  });
});

describe("Google Meet", () => {
  it("sem o Google conectado, a reunião é salva com um aviso", async () => {
    const dono = await criarUsuario();
    const evento = await criarEvento(dono.id, reuniao([], { meet: true }));
    expect(evento).toMatchObject({ meetLink: null, aviso: AVISO_SEM_INTEGRACAO });
  });

  it("gera o link pela agenda do organizador", async () => {
    const dono = await criarUsuario();
    await conectar(dono.id);
    const chamadas = simularGoogle(() => ({
      corpo: { id: "google-meet", hangoutLink: "https://meet.google.com/xyz-abcd-efg" },
    }));

    const evento = await criarEvento(dono.id, reuniao([], { meet: true }));
    expect(evento).toMatchObject({ meetLink: "https://meet.google.com/xyz-abcd-efg", aviso: null });
    const pedido = chamadas.find((c) => c.url.includes("conferenceDataVersion=1"));
    expect(pedido?.corpo).toHaveProperty("conferenceData.createRequest.conferenceSolutionKey.type", "hangoutsMeet");
  });

  it("se o Google falhar, salva sem link e avisa", async () => {
    const dono = await criarUsuario();
    await conectar(dono.id);
    simularGoogle(() => ({ status: 500, corpo: { error: { message: "Erro" } } }));
    const evento = await criarEvento(dono.id, reuniao([], { meet: true }));
    expect(evento).toMatchObject({ meetLink: null, aviso: AVISO_FALHA_NO_MEET });
  });
});

describe("conexão e desconexão", () => {
  it("o endereço do Google pede só a agenda criada pelo app, com state e PKCE", async () => {
    const pessoa = await criarUsuario();
    const { url } = await iniciarConexao(pessoa.id);
    const params = new URL(url).searchParams;
    expect(params.get("scope")).toBe("openid email https://www.googleapis.com/auth/calendar.app.created");
    expect(params.get("access_type")).toBe("offline");
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(
      await prisma.verification.count({ where: { identifier: `google-agenda:${params.get("state")}` } }),
    ).toBe(1);
  });

  it("recusa state desconhecido e state iniciado por outra pessoa", async () => {
    const ana = await criarUsuario();
    const bruno = await criarUsuario();
    await expect(concluirConexao("inexistente", "codigo", ana.id)).rejects.toMatchObject({
      code: "DADOS_INVALIDOS",
    });

    const { url } = await iniciarConexao(ana.id);
    const state = new URL(url).searchParams.get("state")!;
    await expect(concluirConexao(state, "codigo", bruno.id)).rejects.toMatchObject({
      code: "DADOS_INVALIDOS",
    });
  });

  it("desconectar tira o Meet das reuniões futuras e avisa os participantes", async () => {
    const dono = await criarUsuario();
    const convidado = await criarUsuario();
    await colegasDeEquipe(dono.id, convidado.id);
    await conectar(dono.id);
    simularGoogle(() => ({ corpo: { id: "g-meet", hangoutLink: "https://meet.google.com/aaa-bbbb-ccc" } }));
    const evento = await criarEvento(dono.id, reuniao([convidado.id], { meet: true }));

    const chamadas = simularGoogle(() => ({ status: 204 }));
    await desconectar(dono.id);

    expect((await prisma.calendarEvent.findUniqueOrThrow({ where: { id: evento.id } })).meetLink).toBeNull();
    expect(
      await prisma.notification.count({ where: { userId: convidado.id, type: "REUNIAO_ALTERADA" } }),
    ).toBe(1);
    expect(chamadas.some((c) => c.metodo === "DELETE" && c.url.includes("/calendars/"))).toBe(true);
    expect(await prisma.googleIntegration.count({ where: { userId: dono.id } })).toBe(0);
  });
});
