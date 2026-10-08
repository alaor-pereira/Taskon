import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  esvaziarLixeira,
  excluirEmLoteDefinitivamente,
  excluirProjetoDefinitivamente,
  excluirTarefaDefinitivamente,
  listarLixeira,
  restaurarEmLote,
  restaurarProjeto,
  restaurarTarefa,
  TETO_DA_LIXEIRA,
} from "../../modules/trash/trash.service.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";

const idDoProjeto = z.object({ projectId: z.string().uuid() });
const idDaTarefa = z.object({ taskId: z.string().uuid() });
const selecao = z.object({
  projetos: z.array(z.string().uuid()).max(TETO_DA_LIXEIRA).default([]),
  tarefas: z.array(z.string().uuid()).max(TETO_DA_LIXEIRA).default([]),
});

export async function rotasDeLixeira(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirAutenticacao);

  app.get("/", async (request) => {
    const { limite } = z
      .object({
        limite: z.coerce.number().int().min(1).max(TETO_DA_LIXEIRA).optional(),
      })
      .parse(request.query);

    return listarLixeira(usuarioDe(request).id, limite);
  });

  app.post("/projetos/:projectId/restaurar", async (request) => {
    const { projectId } = idDoProjeto.parse(request.params);
    return restaurarProjeto(usuarioDe(request).id, projectId);
  });

  app.delete("/projetos/:projectId", async (request, reply) => {
    const { projectId } = idDoProjeto.parse(request.params);
    await excluirProjetoDefinitivamente(usuarioDe(request).id, projectId);
    return reply.status(204).send();
  });

  app.post("/tarefas/:taskId/restaurar", async (request) => {
    const { taskId } = idDaTarefa.parse(request.params);
    return restaurarTarefa(usuarioDe(request).id, taskId);
  });

  app.delete("/tarefas/:taskId", async (request, reply) => {
    const { taskId } = idDaTarefa.parse(request.params);
    await excluirTarefaDefinitivamente(usuarioDe(request).id, taskId);
    return reply.status(204).send();
  });

  // Lotes: cada item é processado por conta própria, e a resposta diz o que
  // deu certo e o que falhou (com o motivo).
  app.post("/lote/restaurar", async (request) =>
    restaurarEmLote(usuarioDe(request).id, selecao.parse(request.body)),
  );

  app.post("/lote/excluir", async (request) =>
    excluirEmLoteDefinitivamente(usuarioDe(request).id, selecao.parse(request.body)),
  );

  app.post("/esvaziar", async (request) => esvaziarLixeira(usuarioDe(request).id));
}
