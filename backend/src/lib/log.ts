import { createHash } from "node:crypto";
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";
import { pino } from "pino";
import { isTest } from "../config/env.js";

/**
 * Logger único do backend: o Fastify o usa nas requisições, e os módulos que
 * vivem fora de uma requisição (hooks do Better Auth, cron) o importam daqui.
 *
 * Duas proteções:
 * - tokens que viajam no caminho da URL (convite, redefinição de senha,
 *   verificação de e-mail) são trocados por `<token>` antes de registrar;
 * - cabeçalhos e campos sensíveis são removidos onde quer que apareçam.
 */

/** Trechos de URL que carregam um segredo logo depois do prefixo. */
const URLS_COM_TOKEN = [
  /(\/api\/convites\/token\/)[^/?#]+/,
  /(\/api\/auth\/reset-password\/)[^/?#]+/,
];

export function urlSemSegredos(url: string): string {
  let limpa = url;
  for (const padrao of URLS_COM_TOKEN) limpa = limpa.replace(padrao, "$1<token>");
  // Tokens também chegam na query (verify-email?token=, callbacks OAuth com code/state).
  return limpa.replace(/([?&](?:token|code|state)=)[^&#]*/g, "$1<token>");
}

// Tipado como o logger do Fastify para entrar em `loggerInstance` sem
// conflitar com as rotas e plugins, que esperam esse tipo.
export const log: FastifyBaseLogger = pino({
  level: isTest ? "silent" : "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
      "*.senha",
      "*.token",
      "*.secret",
    ],
    censor: "[removido]",
  },
  serializers: {
    req: (request: FastifyRequest) => ({
      method: request.method,
      url: urlSemSegredos(request.url),
      ip: request.ip,
    }),
    res: (reply: FastifyReply) => ({ statusCode: reply.statusCode }),
    err: pino.stdSerializers.err,
  },
});

/**
 * Identifica uma conta no log sem gravar o e-mail: o mesmo endereço gera
 * sempre o mesmo resumo, o que basta para correlacionar tentativas.
 */
export const resumoDoEmail = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 12);
