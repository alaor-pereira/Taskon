import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buscar } from "../../modules/search/search.service.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";

export async function rotasDeBusca(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirAutenticacao);

  app.get("/", async (request) => {
    const { q, limite } = z
      .object({
        q: z.string().max(200).default(""),
        limite: z.coerce.number().int().min(1).max(25).optional(),
      })
      .parse(request.query);

    return buscar(usuarioDe(request).id, q, limite);
  });
}
