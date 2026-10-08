import { Difficulty, TaskPriority, TaskStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  atualizarTarefa,
  criarTarefa,
  definirResponsaveis,
  excluirTarefa,
  moverTarefa,
  obterTarefa,
  porPrioridade,
  recentes,
  todasAsTarefas,
  vencemHoje,
  vencidas,
} from "../../modules/tasks/tasks.service.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";

const idDaTarefa = z.object({ taskId: z.string().uuid() });
const status = z.nativeEnum(TaskStatus);
const prioridade = z.nativeEnum(TaskPriority);
const dificuldade = z.nativeEnum(Difficulty);
/** Data pura, sem hora: o vencimento não depende de fuso. */
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");

export async function rotasDeTarefas(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirAutenticacao);

  // --- Listas da barra lateral ---------------------------------------------

  app.get("/vencem-hoje", async (request) => {
    const usuario = usuarioDe(request);
    // "Hoje" é resolvido no servidor, pelo fuso do perfil: deixar isso com o
    // cliente faria a lista mudar conforme o relógio da máquina.
    return vencemHoje(usuario.id, usuario.timezone);
  });

  app.get("/vencidas", async (request) => {
    const usuario = usuarioDe(request);
    return vencidas(usuario.id, usuario.timezone);
  });

  app.get("/recentes", async (request) => {
    return recentes(usuarioDe(request).id);
  });

  app.get("/por-prioridade/:priority", async (request) => {
    const { priority } = z.object({ priority: prioridade }).parse(request.params);
    return porPrioridade(usuarioDe(request).id, priority);
  });

  // Conjunto completo, sem limite, para a página "Ver todas as tarefas".
  app.get("/todas", async (request) => {
    const { projectId } = z
      .object({ projectId: z.string().uuid().optional() })
      .parse(request.query);
    return todasAsTarefas(usuarioDe(request).id, { projectId });
  });

  // --- Tarefa --------------------------------------------------------------

  app.get("/:taskId", async (request) => {
    const { taskId } = idDaTarefa.parse(request.params);
    return obterTarefa(usuarioDe(request).id, taskId);
  });

  app.post("/", async (request, reply) => {
    const corpo = z
      .object({
        // Sem projeto, a tarefa vai para a Caixa de entrada.
        projectId: z.string().uuid().nullable().optional(),
        parentId: z.string().uuid().nullable().optional(),
        title: z.string().trim().min(1).max(300),
        description: z.string().trim().max(10000).nullable().optional(),
        status: status.optional(),
        priority: prioridade.optional(),
        difficulty: dificuldade.nullable().optional(),
        dueDate: dataIso.nullable().optional(),
        assigneeIds: z.array(z.string().uuid()).max(50).optional(),
      })
      .parse(request.body);

    const tarefa = await criarTarefa(usuarioDe(request).id, corpo);
    return reply.status(201).send(tarefa);
  });

  app.patch("/:taskId", async (request) => {
    const { taskId } = idDaTarefa.parse(request.params);
    const corpo = z
      .object({
        title: z.string().trim().min(1).max(300).optional(),
        description: z.string().trim().max(10000).nullable().optional(),
        priority: prioridade.optional(),
        difficulty: dificuldade.nullable().optional(),
        dueDate: dataIso.nullable().optional(),
        status: status.optional(),
        // Obrigatória: é ela que detecta alteração simultânea.
        version: z.number().int().positive(),
        concluirComSubtarefasAbertas: z.boolean().optional(),
      })
      .parse(request.body);

    return atualizarTarefa(usuarioDe(request).id, taskId, corpo);
  });

  app.post("/:taskId/mover", async (request) => {
    const { taskId } = idDaTarefa.parse(request.params);
    const corpo = z
      .object({
        status,
        // Nulo significa "no fim da coluna".
        antesDeId: z.string().uuid().nullable().optional(),
      })
      .parse(request.body);

    return moverTarefa(usuarioDe(request).id, taskId, corpo);
  });

  app.put("/:taskId/responsaveis", async (request, reply) => {
    const { taskId } = idDaTarefa.parse(request.params);
    const { assigneeIds } = z
      .object({ assigneeIds: z.array(z.string().uuid()).max(50) })
      .parse(request.body);

    await definirResponsaveis(usuarioDe(request).id, taskId, assigneeIds);
    return reply.status(204).send();
  });

  app.delete("/:taskId", async (request) => {
    const { taskId } = idDaTarefa.parse(request.params);
    return excluirTarefa(usuarioDe(request).id, taskId);
  });
}
