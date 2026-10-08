import { Difficulty, ProjectRole, TaskPriority, TaskStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  adicionarMembro,
  alterarPapelDeMembro,
  atualizarProjeto,
  candidatosAMembro,
  criarProjeto,
  excluirProjeto,
  listarProjetos,
  listarTodosOsProjetos,
  obterProjeto,
  removerMembro,
  transferirPropriedade,
} from "../../modules/projects/projects.service.js";
import { listarTarefasDoProjeto } from "../../modules/tasks/tasks.service.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";

const idDoProjeto = z.object({ projectId: z.string().uuid() });
const papel = z.nativeEnum(ProjectRole);
/** Data pura, sem hora: o prazo não depende de fuso. */
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");

export async function rotasDeProjetos(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirAutenticacao);

  app.get("/", async (request) => {
    const { limite } = z
      .object({ limite: z.coerce.number().int().min(1).max(100).optional() })
      .parse(request.query);

    return listarProjetos(usuarioDe(request).id, limite);
  });

  // Conjunto completo, sem limite, para a página "Ver todos os projetos".
  app.get("/todos", async (request) => {
    return listarTodosOsProjetos(usuarioDe(request).id);
  });

  app.post("/", async (request, reply) => {
    const corpo = z
      .object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(2000).optional(),
        teamId: z.string().uuid().nullable().optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        difficulty: z.nativeEnum(Difficulty).nullable().optional(),
        dueDate: dataIso.nullable().optional(),
      })
      .parse(request.body);

    const projeto = await criarProjeto(usuarioDe(request).id, corpo);
    return reply.status(201).send(projeto);
  });

  app.get("/:projectId", async (request) => {
    const { projectId } = idDoProjeto.parse(request.params);
    return obterProjeto(usuarioDe(request).id, projectId);
  });

  app.patch("/:projectId", async (request) => {
    const { projectId } = idDoProjeto.parse(request.params);
    const corpo = z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        status: z.nativeEnum(TaskStatus).optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        difficulty: z.nativeEnum(Difficulty).nullable().optional(),
        dueDate: dataIso.nullable().optional(),
      })
      .parse(request.body);

    return atualizarProjeto(usuarioDe(request).id, projectId, corpo);
  });

  app.delete("/:projectId", async (request) => {
    const { projectId } = idDoProjeto.parse(request.params);
    return excluirProjeto(usuarioDe(request).id, projectId);
  });

  app.post("/:projectId/transferir", async (request, reply) => {
    const { projectId } = idDoProjeto.parse(request.params);
    const { novoDonoId } = z
      .object({ novoDonoId: z.string().uuid() })
      .parse(request.body);

    await transferirPropriedade(usuarioDe(request).id, projectId, novoDonoId);
    return reply.status(204).send();
  });

  // --- Tarefas do projeto --------------------------------------------------

  app.get("/:projectId/tarefas", async (request) => {
    const { projectId } = idDoProjeto.parse(request.params);
    const query = z
      .object({
        status: z
          .enum([
            "BACKLOG",
            "A_FAZER",
            "EM_ANDAMENTO",
            "EM_REVISAO",
            "EM_PAUSA",
            "CONCLUIDO",
          ])
          .optional(),
        incluirSubtarefas: z.coerce.boolean().optional(),
      })
      .parse(request.query);

    return listarTarefasDoProjeto(usuarioDe(request).id, projectId, query);
  });

  // --- Membros -------------------------------------------------------------

  app.get("/:projectId/candidatos", async (request) => {
    const { projectId } = idDoProjeto.parse(request.params);
    return candidatosAMembro(usuarioDe(request).id, projectId);
  });

  app.post("/:projectId/membros", async (request, reply) => {
    const { projectId } = idDoProjeto.parse(request.params);
    const corpo = z
      .object({ userId: z.string().uuid(), role: papel })
      .parse(request.body);

    const membro = await adicionarMembro(usuarioDe(request).id, projectId, corpo);
    return reply.status(201).send(membro);
  });

  app.patch("/:projectId/membros/:membroId", async (request) => {
    const { projectId, membroId } = idDoProjeto
      .extend({ membroId: z.string().uuid() })
      .parse(request.params);
    const { role } = z.object({ role: papel }).parse(request.body);

    return alterarPapelDeMembro(usuarioDe(request).id, projectId, membroId, role);
  });

  app.delete("/:projectId/membros/:membroId", async (request, reply) => {
    const { projectId, membroId } = idDoProjeto
      .extend({ membroId: z.string().uuid() })
      .parse(request.params);

    await removerMembro(usuarioDe(request).id, projectId, membroId);
    return reply.status(204).send();
  });

  app.post("/:projectId/sair", async (request, reply) => {
    const { projectId } = idDoProjeto.parse(request.params);
    const usuario = usuarioDe(request);

    await removerMembro(usuario.id, projectId, usuario.id);
    return reply.status(204).send();
  });
}
