import { ViewEntityType, ViewMode, ViewPage } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  definirVisualizacao,
  definirVisualizacaoDaPagina,
  obterVisualizacao,
  obterVisualizacaoDaPagina,
} from "../../modules/preferences/view-preferences.service.js";
import {
  definirNotificacoesDesativadas,
  obterNotificacoesDesativadas,
} from "../../modules/notifications/notifications.service.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";

const parametros = z.object({
  entityType: z.nativeEnum(ViewEntityType),
  entityId: z.string().uuid(),
});

const parametrosDaPagina = z.object({ pagina: z.nativeEnum(ViewPage) });

const corpo = z.object({ view: z.nativeEnum(ViewMode) });

const corpoDeNotificacoes = z.object({ desativadas: z.array(z.string().max(60)).max(50) });

export async function rotasDePreferencias(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirAutenticacao);

  app.get("/visualizacao/:entityType/:entityId", async (request) => {
    const { entityType, entityId } = parametros.parse(request.params);
    const view = await obterVisualizacao(usuarioDe(request).id, entityType, entityId);
    return { view };
  });

  app.put("/visualizacao/:entityType/:entityId", async (request, reply) => {
    const { entityType, entityId } = parametros.parse(request.params);
    const { view } = corpo.parse(request.body);

    await definirVisualizacao(usuarioDe(request).id, entityType, entityId, view);
    return reply.status(204).send();
  });

  // Caminho próprio, e não "/visualizacao/pagina/:pagina": com dois segmentos,
  // ele competiria com a rota de cima pelo mesmo formato de URL.
  app.get("/visualizacao-pagina/:pagina", async (request) => {
    const { pagina } = parametrosDaPagina.parse(request.params);
    const view = await obterVisualizacaoDaPagina(usuarioDe(request).id, pagina);
    return { view };
  });

  app.put("/visualizacao-pagina/:pagina", async (request, reply) => {
    const { pagina } = parametrosDaPagina.parse(request.params);
    const { view } = corpo.parse(request.body);

    await definirVisualizacaoDaPagina(usuarioDe(request).id, pagina, view);
    return reply.status(204).send();
  });

  // Avisos desligados em Configurações > Notificações — só valem para quem
  // escolheu; ninguém altera a preferência de outra pessoa.
  app.get("/notificacoes", async (request) => {
    const desativadas = await obterNotificacoesDesativadas(usuarioDe(request).id);
    return { desativadas };
  });

  app.put("/notificacoes", async (request, reply) => {
    const { desativadas } = corpoDeNotificacoes.parse(request.body);
    await definirNotificacoesDesativadas(usuarioDe(request).id, desativadas);
    return reply.status(204).send();
  });
}
