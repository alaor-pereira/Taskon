import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  aceitarConvite,
  listarConvitesRecebidos,
  recusarConvite,
  verConvitePorToken,
} from "../../modules/invitations/invitations.service.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";

const idDoConvite = z.object({ conviteId: z.string().uuid() });

export async function rotasDeConvites(app: FastifyInstance): Promise<void> {
  /**
   * Consulta pública por token, usada pela tela que o link do e-mail abre.
   * Não exige sessão: quem ainda não tem conta precisa ver de qual equipe é o
   * convite antes de decidir se cria uma. Devolve só nome e descrição da
   * equipe, nunca a lista de membros ou projetos.
   */
  app.get("/token/:token", async (request) => {
    const { token } = z.object({ token: z.string().min(10) }).parse(request.params);
    return verConvitePorToken(token);
  });

  app.register(async (protegidas) => {
    protegidas.addHook("preHandler", exigirAutenticacao);

    protegidas.get("/", async (request) => {
      return listarConvitesRecebidos(usuarioDe(request).id);
    });

    protegidas.post("/:conviteId/aceitar", async (request) => {
      const { conviteId } = idDoConvite.parse(request.params);
      return aceitarConvite(usuarioDe(request).id, conviteId);
    });

    protegidas.post("/:conviteId/recusar", async (request, reply) => {
      const { conviteId } = idDoConvite.parse(request.params);
      await recusarConvite(usuarioDe(request).id, conviteId);
      return reply.status(204).send();
    });
  });
}
