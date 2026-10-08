import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import {
  concluirConexao,
  desconectar,
  iniciarConexao,
  situacaoDaIntegracao,
} from "../../modules/integrations/google/integracao.service.js";
import { exigirAutenticacao, resolverUsuario, usuarioDe } from "../session.js";

const corpoDaConexao = z.object({
  // Sem o "sim" explícito dado no diálogo, nada vai para o Google (LGPD, art. 7º, I).
  consentimento: z.literal(true),
});

const retornoDoGoogle = z.object({
  code: z.string().min(1).max(2048).optional(),
  state: z.string().min(1).max(256).optional(),
  error: z.string().max(200).optional(),
});

/** Integração com o Google Agenda (só Taskon → Google). */
export async function rotasDeIntegracoes(app: FastifyInstance): Promise<void> {
  // O retorno do Google é uma navegação vinda de lá: não exige sessão, mas o
  // `state` só vale para quem iniciou a conexão.
  app.get("/google/callback", async (request, reply) => {
    const destino = new URL(env.FRONTEND_URL);
    const { code, state, error } = retornoDoGoogle.parse(request.query);

    if (error || !code || !state) {
      destino.searchParams.set("google", error === "access_denied" ? "negado" : "erro");
      return reply.redirect(destino.toString());
    }

    try {
      const sessao = await resolverUsuario(request);
      await concluirConexao(state, code, sessao?.id ?? null);
      destino.searchParams.set("google", "conectado");
    } catch (erro) {
      request.log.warn({ err: erro }, "Falha ao conectar o Google Agenda");
      destino.searchParams.set("google", "erro");
      if (erro instanceof AppError) destino.searchParams.set("motivo", erro.message);
    }
    return reply.redirect(destino.toString());
  });

  await app.register(async (protegidas) => {
    protegidas.addHook("preHandler", exigirAutenticacao);

    protegidas.get("/google", async (request) => situacaoDaIntegracao(usuarioDe(request).id));

    protegidas.post(
      "/google/conectar",
      { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
      async (request) => {
        corpoDaConexao.parse(request.body);
        return iniciarConexao(usuarioDe(request).id);
      },
    );

    protegidas.delete("/google", async (request, reply) => {
      await desconectar(usuarioDe(request).id);
      return reply.status(204).send();
    });
  });
}
