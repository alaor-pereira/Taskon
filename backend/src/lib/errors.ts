/**
 * Erros de domínio. Os serviços lançam estes tipos; a camada HTTP os traduz em
 * respostas. Nenhum serviço conhece códigos HTTP.
 */

export type ErrorCode =
  | "NAO_AUTENTICADO"
  | "NAO_ENCONTRADO"
  | "SEM_PERMISSAO"
  | "DADOS_INVALIDOS"
  | "CONFLITO"
  | "REGRA_DE_NEGOCIO";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export const naoAutenticado = () =>
  new AppError("NAO_AUTENTICADO", "É necessário estar autenticado.");

/**
 * Usado também quando o usuário não tem acesso de leitura ao recurso.
 * Um projeto invisível deve ser indistinguível de um projeto inexistente,
 * senão a mensagem de erro revela que ele existe.
 */
export const naoEncontrado = (recurso = "Recurso") =>
  new AppError("NAO_ENCONTRADO", `${recurso} não encontrado.`);

/** Só para quando o usuário já enxerga o recurso mas não pode executar a ação. */
export const semPermissao = (acao = "executar esta ação") =>
  new AppError("SEM_PERMISSAO", `Você não tem permissão para ${acao}.`);

export const dadosInvalidos = (message: string, details?: unknown) =>
  new AppError("DADOS_INVALIDOS", message, details);

export const conflito = (message: string, details?: unknown) =>
  new AppError("CONFLITO", message, details);

export const regraDeNegocio = (message: string, details?: unknown) =>
  new AppError("REGRA_DE_NEGOCIO", message, details);

const statusPorCodigo: Record<ErrorCode, number> = {
  NAO_AUTENTICADO: 401,
  NAO_ENCONTRADO: 404,
  SEM_PERMISSAO: 403,
  DADOS_INVALIDOS: 422,
  CONFLITO: 409,
  REGRA_DE_NEGOCIO: 409,
};

export const statusHttp = (code: ErrorCode): number => statusPorCodigo[code];
