import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";
import { rotasDeAgenda } from "./calendar.routes.js";
import { rotasDeBusca } from "./search.routes.js";
import { rotasDeCron } from "./cron.routes.js";
import { rotasDeDashboard } from "./dashboard.routes.js";
import { rotasDeComentarios } from "./comments.routes.js";
import { rotasDeConvites } from "./invitations.routes.js";
import { rotasDeLixeira } from "./trash.routes.js";
import { rotasDeNotificacoes } from "./notifications.routes.js";
import { rotasDePreferencias } from "./preferences.routes.js";
import { rotasDePerfil, rotasDeUsuarios } from "./profile.routes.js";
import { rotasDeProjetos } from "./projects.routes.js";
import { rotasDeTarefas } from "./tasks.routes.js";
import { rotasDeEquipes } from "./teams.routes.js";
import { rotasDeIntegracoes } from "./integrations.routes.js";
import { rotasDeTermos } from "./terms.routes.js";

/**
 * Registro central de rotas. Cada módulo de negócio entra aqui com seu prefixo.
 * As rotas da agenda e do dashboard chegam nas fases seguintes.
 */
export async function registrarRotas(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", banco: "conectado" };
  });

  // Identidade do usuário logado, para o rodapé da sidebar.
  app.get("/api/me", { preHandler: exigirAutenticacao }, async (request) => {
    return { usuario: usuarioDe(request) };
  });

  await app.register(rotasDeEquipes, { prefix: "/api/equipes" });
  await app.register(rotasDeProjetos, { prefix: "/api/projetos" });
  await app.register(rotasDeTarefas, { prefix: "/api/tarefas" });
  await app.register(rotasDeAgenda, { prefix: "/api/agenda" });
  await app.register(rotasDeDashboard, { prefix: "/api/dashboard" });
  await app.register(rotasDeCron, { prefix: "/api/cron" });
  await app.register(rotasDeComentarios, { prefix: "/api/comentarios" });
  await app.register(rotasDeLixeira, { prefix: "/api/lixeira" });
  await app.register(rotasDeBusca, { prefix: "/api/busca" });
  await app.register(rotasDeConvites, { prefix: "/api/convites" });
  await app.register(rotasDeNotificacoes, { prefix: "/api/notificacoes" });
  await app.register(rotasDePreferencias, { prefix: "/api/preferencias" });
  await app.register(rotasDePerfil, { prefix: "/api/perfil" });
  await app.register(rotasDeUsuarios, { prefix: "/api/usuarios" });
  await app.register(rotasDeTermos, { prefix: "/api/termos" });
  await app.register(rotasDeIntegracoes, { prefix: "/api/integracoes" });
}
