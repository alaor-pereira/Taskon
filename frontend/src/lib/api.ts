import { t } from "./messages";

/**
 * Cliente HTTP do backend.
 *
 * Backend e frontend vivem em origens distintas, então toda chamada precisa de
 * `credentials: "include"` para levar o cookie de sessão. Sem isso, a API
 * responderia 401 mesmo com o usuário logado.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export class ApiError extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly detalhes?: unknown;

  constructor(status: number, codigo: string, mensagem: string, detalhes?: unknown) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }

  /** Conflito de versão: outra pessoa alterou o mesmo item. */
  get ehConflito() {
    return this.codigo === "CONFLITO";
  }
}

interface OpcoesApi extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function api<T>(caminho: string, opcoes: OpcoesApi = {}): Promise<T> {
  const { body, headers, ...resto } = opcoes;

  let resposta: Response;
  try {
    resposta = await fetch(`${API_URL}${caminho}`, {
      ...resto,
      credentials: "include",
      headers: {
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, "SEM_CONEXAO", t.erros.semConexao);
  }

  if (resposta.status === 204) return undefined as T;

  const texto = await resposta.text();
  const dados = texto ? safeJson(texto) : null;

  if (!resposta.ok) {
    const corpo = dados as
      | { erro?: string; mensagem?: string; detalhes?: unknown }
      | null;
    throw new ApiError(
      resposta.status,
      corpo?.erro ?? "ERRO",
      corpo?.mensagem ?? t.erros.generico,
      corpo?.detalhes,
    );
  }

  return dados as T;
}

function safeJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

export const get = <T>(caminho: string) => api<T>(caminho);
export const post = <T>(caminho: string, body?: unknown) =>
  api<T>(caminho, { method: "POST", body });
export const patch = <T>(caminho: string, body?: unknown) =>
  api<T>(caminho, { method: "PATCH", body });
export const put = <T>(caminho: string, body?: unknown) =>
  api<T>(caminho, { method: "PUT", body });
export const del = <T>(caminho: string, body?: unknown) =>
  api<T>(caminho, { method: "DELETE", body });
