import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  comentar,
  editarComentario,
  listarComentarios,
  mencionaveis,
  removerComentario,
} from "../../modules/comments/comments.service.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";

const corpo = z.object({ bodyMd: z.string().trim().min(1).max(10000) });

export async function rotasDeComentarios(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirAutenticacao);

  app.get("/tarefa/:taskId", async (request) => {
    const { taskId } = z.object({ taskId: z.string().uuid() }).parse(request.params);
    return listarComentarios(usuarioDe(request).id, taskId);
  });

  /** Candidatos para o seletor de @menção: só membros do projeto. */
  app.get("/tarefa/:taskId/mencionaveis", async (request) => {
    const { taskId } = z.object({ taskId: z.string().uuid() }).parse(request.params);
    return mencionaveis(usuarioDe(request).id, taskId);
  });

  app.post("/tarefa/:taskId", async (request, reply) => {
    const { taskId } = z.object({ taskId: z.string().uuid() }).parse(request.params);
    const { bodyMd } = corpo.parse(request.body);

    const comentario = await comentar(usuarioDe(request).id, taskId, bodyMd);
    return reply.status(201).send(comentario);
  });

  app.patch("/:commentId", async (request) => {
    const { commentId } = z
      .object({ commentId: z.string().uuid() })
      .parse(request.params);
    const { bodyMd } = corpo.parse(request.body);

    return editarComentario(usuarioDe(request).id, commentId, bodyMd);
  });

  app.delete("/:commentId", async (request, reply) => {
    const { commentId } = z
      .object({ commentId: z.string().uuid() })
      .parse(request.params);

    await removerComentario(usuarioDe(request).id, commentId);
    return reply.status(204).send();
  });
}
