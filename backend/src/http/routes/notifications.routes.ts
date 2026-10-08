import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  contarNaoLidas,
  listarNotificacoes,
  marcarComoLida,
  marcarTodasComoLidas,
} from "../../modules/notifications/notifications.service.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";

export async function rotasDeNotificacoes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirAutenticacao);

  app.get("/", async (request) => {
    const query = z
      .object({
        naoLidas: z.coerce.boolean().optional(),
        limite: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse(request.query);

    const [itens, naoLidas] = await Promise.all([
      listarNotificacoes(usuarioDe(request).id, {
        apenasNaoLidas: query.naoLidas,
        limite: query.limite,
      }),
      contarNaoLidas(usuarioDe(request).id),
    ]);

    return { itens, naoLidas };
  });

  app.post("/:notificacaoId/lida", async (request, reply) => {
    const { notificacaoId } = z
      .object({ notificacaoId: z.string().uuid() })
      .parse(request.params);

    await marcarComoLida(usuarioDe(request).id, notificacaoId);
    return reply.status(204).send();
  });

  app.post("/lidas", async (request) => {
    const total = await marcarTodasComoLidas(usuarioDe(request).id);
    return { marcadas: total };
  });
}
