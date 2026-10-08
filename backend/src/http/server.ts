import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { env, isProduction, isTest } from "../config/env.js";
import { auth } from "../lib/auth.js";
import { AppError, statusHttp } from "../lib/errors.js";
import { registrarEvento } from "../lib/eventos-de-seguranca.js";
import { log } from "../lib/log.js";
import { paraRequestWeb } from "./headers.js";
import { registrarRotas } from "./routes/index.js";

/** Rotas fora do limite geral: o Better Auth tem o próprio, mais rígido. */
const foraDoLimiteGeral = (url: string) => url.startsWith("/api/auth/") || url === "/health";

export async function criarServidor(): Promise<FastifyInstance> {
  const app = Fastify({
    // Logger compartilhado com o resto do backend; tira tokens das URLs e
    // remove cookies e senhas do que for registrado (ver lib/log.ts).
    loggerInstance: log,
    // Confia só nos proxies declarados: com `true`, qualquer cliente poderia
    // escolher o próprio IP mandando X-Forwarded-For. O proxy de produção
    // termina o TLS; sem confiar nele, os links gerados sairiam em http.
    trustProxy: (_endereco: string, salto: number) => salto < env.TRUST_PROXY_HOPS,
  });

  // A API só responde JSON: a política mais fechada possível. O HSTS só faz
  // sentido atrás de HTTPS, ou seja, em produção.
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
  });

  // Uma origem só: o frontend. `credentials` é obrigatório porque a sessão
  // trafega em cookie entre origens distintas.
  await app.register(cors, {
    origin: [env.FRONTEND_URL],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  // Limite geral por IP para as rotas de negócio, contra abuso e varredura.
  // Folgado para o uso normal do app (que dispara várias consultas por tela).
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    allowList: (request) => isTest || foraDoLimiteGeral(request.url),
    onExceeded: (request) =>
      registrarEvento("rate_limit.atingido", {
        ip: request.ip,
        rota: request.routeOptions.url,
        userAgent: request.headers["user-agent"],
      }),
    errorResponseBuilder: (_request, contexto) => ({
      statusCode: 429,
      erro: "MUITAS_REQUISICOES",
      mensagem: `Muitas requisições. Tente de novo em ${contexto.after}.`,
    }),
  });

  await app.register(cookie);

  // --- Better Auth ---------------------------------------------------------
  // Tudo sob /api/auth (cadastro, login, social, verificação, senha) é tratado
  // pela biblioteca. As rotas de negócio ficam fora deste prefixo.
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const resposta = await auth.handler(paraRequestWeb(request));

      reply.status(resposta.status);
      for (const [chave, valor] of resposta.headers.entries()) {
        // set-cookie pode vir repetido; `header` acumula corretamente.
        reply.header(chave, valor);
      }
      const corpo = await resposta.text();
      return reply.send(corpo || null);
    },
  });

  // --- Tradução de erros ---------------------------------------------------
  app.setErrorHandler((erro, request, reply) => {
    if (erro instanceof AppError) {
      // Acesso negado e "não encontrado" (como o sistema responde a quem não
      // enxerga o recurso) são o rastro de quem tenta adivinhar ids.
      if (erro.code === "SEM_PERMISSAO" || erro.code === "NAO_ENCONTRADO") {
        registrarEvento("acesso.negado", {
          userId: request.usuario?.id ?? null,
          ip: request.ip,
          codigo: erro.code,
          metodo: request.method,
          rota: request.routeOptions.url,
        });
      }
      return reply.status(statusHttp(erro.code)).send({
        erro: erro.code,
        mensagem: erro.message,
        detalhes: erro.details,
      });
    }

    if (erro instanceof ZodError) {
      return reply.status(422).send({
        erro: "DADOS_INVALIDOS",
        mensagem: "Os dados enviados são inválidos.",
        detalhes: erro.issues.map((i) => ({
          campo: i.path.join("."),
          mensagem: i.message,
        })),
      });
    }

    const comStatus = erro as { statusCode?: number; message?: string; erro?: string; mensagem?: string };

    // Montado pelo errorResponseBuilder do rate limit.
    if (comStatus.statusCode === 429) {
      return reply.status(429).send({ erro: comStatus.erro, mensagem: comStatus.mensagem });
    }

    // Erros do próprio Fastify (corpo malformado, limite de tamanho) já trazem
    // um status utilizável; só os repassamos quando não são falha de servidor.
    if (typeof comStatus.statusCode === "number" && comStatus.statusCode < 500) {
      return reply.status(comStatus.statusCode).send({
        erro: "DADOS_INVALIDOS",
        mensagem: comStatus.message ?? "Requisição inválida.",
      });
    }

    // Só o inesperado chega aqui. O detalhe fica no log, não na resposta.
    request.log.error({ err: erro }, "Erro não tratado");
    return reply.status(500).send({
      erro: "ERRO_INTERNO",
      mensagem: "Ocorreu um erro inesperado.",
    });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({
      erro: "NAO_ENCONTRADO",
      mensagem: "Rota não encontrada.",
    }),
  );

  await registrarRotas(app);

  return app;
}
