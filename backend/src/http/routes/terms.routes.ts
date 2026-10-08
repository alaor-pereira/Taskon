import { TermsAcceptanceOrigin } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registrarAceite, situacaoDosTermos } from "../../modules/terms/terms.service.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";

const corpoDoAceite = z.object({
  origem: z.nativeEnum(TermsAcceptanceOrigin).default(TermsAcceptanceOrigin.REACEITE),
});

/** Situação e registro do aceite dos documentos legais pelo usuário logado. */
export async function rotasDeTermos(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirAutenticacao);

  app.get("/situacao", async (request) => situacaoDosTermos(usuarioDe(request).id));

  app.post("/aceite", async (request) => {
    const { origem } = corpoDoAceite.parse(request.body ?? {});
    const usuario = usuarioDe(request);
    await registrarAceite(usuario.id, origem, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return situacaoDosTermos(usuario.id);
  });
}
