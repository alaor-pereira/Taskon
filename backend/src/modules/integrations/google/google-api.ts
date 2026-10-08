import type { GoogleIntegration } from "@prisma/client";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { env } from "../../../config/env.js";

/**
 * Cliente mínimo das APIs do Google usadas pela integração com a agenda.
 *
 * Menor privilégio: o escopo `calendar.app.created` só dá acesso às agendas
 * que o próprio Taskon criou. A agenda pessoal da pessoa nunca é lida nem
 * alterada.
 */

export const ESCOPOS = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.app.created",
] as const;

const URL_DE_AUTORIZACAO = "https://accounts.google.com/o/oauth2/v2/auth";
const URL_DE_TOKEN = "https://oauth2.googleapis.com/token";
const URL_DE_REVOGACAO = "https://oauth2.googleapis.com/revoke";
const API_DA_AGENDA = "https://www.googleapis.com/calendar/v3";

const TEMPO_LIMITE_MS = 10_000;

export const urlDeRetorno = () => `${env.BETTER_AUTH_URL}/api/integracoes/google/callback`;

export function googleConfigurado(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export class ErroDoGoogle extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** O Google não aceita mais as credenciais: só reconectando. */
    readonly acessoPerdido = false,
  ) {
    super(message);
    this.name = "ErroDoGoogle";
  }
}

async function chamar<T>(url: string, init: RequestInit = {}): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(url, { ...init, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
  } catch (erro) {
    throw new ErroDoGoogle(0, `Sem resposta do Google: ${(erro as Error).message}`);
  }
  if (resposta.status === 204) return undefined as T;

  const texto = await resposta.text();
  const corpo = texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
  if (!resposta.ok) {
    const detalhe = corpo.error as { message?: string } | string | undefined;
    const mensagem = typeof detalhe === "string" ? detalhe : (detalhe?.message ?? `HTTP ${resposta.status}`);
    const acessoPerdido = resposta.status === 401 || detalhe === "invalid_grant";
    throw new ErroDoGoogle(resposta.status, mensagem, acessoPerdido);
  }
  return corpo as T;
}

// --- Tokens --------------------------------------------------------------

export const cifrar = (valor: string) => symmetricEncrypt({ key: env.BETTER_AUTH_SECRET, data: valor });
export const decifrar = (valor: string) => symmetricDecrypt({ key: env.BETTER_AUTH_SECRET, data: valor });

export function urlDeAutorizacao(opcoes: { state: string; desafio: string; loginHint?: string }) {
  const url = new URL(URL_DE_AUTORIZACAO);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: urlDeRetorno(),
    response_type: "code",
    scope: ESCOPOS.join(" "),
    // `offline` + `consent` garantem o refresh_token, sem o qual a
    // sincronização pararia depois de uma hora.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: opcoes.state,
    code_challenge: opcoes.desafio,
    code_challenge_method: "S256",
    ...(opcoes.loginHint && { login_hint: opcoes.loginHint }),
  }).toString();
  return url.toString();
}

interface RespostaDeToken {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

export function trocarCodigo(codigo: string, verificador: string) {
  return chamar<RespostaDeToken>(URL_DE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: codigo,
      code_verifier: verificador,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: urlDeRetorno(),
      grant_type: "authorization_code",
    }),
  });
}

function renovar(refreshToken: string) {
  return chamar<RespostaDeToken>(URL_DE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
}

/** O e-mail da conta Google vem no id_token recém-recebido do próprio Google. */
export function emailDoIdToken(idToken: string | undefined): string | null {
  const carga = idToken?.split(".")[1];
  if (!carga) return null;
  const dados = JSON.parse(Buffer.from(carga, "base64url").toString("utf8")) as { email?: string };
  return dados.email ?? null;
}

export async function revogar(token: string): Promise<void> {
  await chamar(URL_DE_REVOGACAO, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
}

/**
 * Token de acesso válido para a integração, renovando-o quando falta menos
 * de um minuto. Quem chama persiste o resultado (`novo`), quando houver.
 */
export async function tokenDeAcesso(integracao: GoogleIntegration): Promise<{
  token: string;
  novo?: { accessToken: string; accessTokenExpiresAt: Date };
}> {
  if (integracao.accessTokenExpiresAt.getTime() - Date.now() > 60_000) {
    return { token: await decifrar(integracao.accessToken) };
  }
  const renovado = await renovar(await decifrar(integracao.refreshToken));
  return {
    token: renovado.access_token,
    novo: {
      accessToken: await cifrar(renovado.access_token),
      accessTokenExpiresAt: new Date(Date.now() + renovado.expires_in * 1000),
    },
  };
}

// --- Agenda --------------------------------------------------------------

const autorizado = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

export async function criarAgenda(token: string, timeZone: string): Promise<string> {
  const agenda = await chamar<{ id: string }>(`${API_DA_AGENDA}/calendars`, {
    method: "POST",
    headers: autorizado(token),
    body: JSON.stringify({
      summary: "Taskon",
      description: "Atividades e reuniões do Taskon. Gerida pelo Taskon: altere pelo app.",
      timeZone,
    }),
  });
  return agenda.id;
}

export async function apagarAgenda(token: string, calendarId: string): Promise<void> {
  await semSeJaSumiu(() =>
    chamar(`${API_DA_AGENDA}/calendars/${encodeURIComponent(calendarId)}`, {
      method: "DELETE",
      headers: autorizado(token),
    }),
  );
}

export interface EventoGoogle {
  id?: string;
  summary?: string;
  description?: string;
  location?: string | null;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  recurrence?: string[] | null;
  status?: "confirmed" | "cancelled";
  hangoutLink?: string;
  conferenceData?: unknown;
  source?: { title: string; url: string };
}

const urlDosEventos = (calendarId: string) =>
  `${API_DA_AGENDA}/calendars/${encodeURIComponent(calendarId)}/events`;

export function inserirEvento(token: string, calendarId: string, evento: EventoGoogle, comMeet = false) {
  const query = comMeet ? "?conferenceDataVersion=1" : "";
  return chamar<EventoGoogle & { id: string }>(`${urlDosEventos(calendarId)}${query}`, {
    method: "POST",
    headers: autorizado(token),
    body: JSON.stringify(evento),
  });
}

export function atualizarEvento(
  token: string,
  calendarId: string,
  googleEventId: string,
  mudancas: EventoGoogle,
  comMeet = false,
) {
  const query = comMeet ? "?conferenceDataVersion=1" : "";
  return chamar<EventoGoogle & { id: string }>(
    `${urlDosEventos(calendarId)}/${encodeURIComponent(googleEventId)}${query}`,
    { method: "PATCH", headers: autorizado(token), body: JSON.stringify(mudancas) },
  );
}

export async function apagarEvento(token: string, calendarId: string, googleEventId: string) {
  await semSeJaSumiu(() =>
    chamar(`${urlDosEventos(calendarId)}/${encodeURIComponent(googleEventId)}`, {
      method: "DELETE",
      headers: autorizado(token),
    }),
  );
}

/**
 * Id de uma ocorrência de série no Google: o id do evento-mestre mais o início
 * original em UTC (`AAAAMMDDTHHMMSSZ`), ou só a data em eventos de dia inteiro.
 */
export function idDaOcorrencia(googleEventId: string, inicioOriginal: Date, diaInteiro: boolean) {
  const iso = inicioOriginal.toISOString();
  const sufixo = diaInteiro
    ? iso.slice(0, 10).replace(/-/g, "")
    : iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return `${googleEventId}_${sufixo}`;
}

/** Excluir algo que já não existe no Google não é erro: o estado final é o desejado. */
async function semSeJaSumiu(acao: () => Promise<unknown>) {
  try {
    await acao();
  } catch (erro) {
    if (erro instanceof ErroDoGoogle && (erro.status === 404 || erro.status === 410)) return;
    throw erro;
  }
}
