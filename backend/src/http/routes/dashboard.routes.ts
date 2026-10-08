import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ehDataValida, hojeNoFuso } from "../../lib/datas.js";
import {
  montarDashboard,
  projetosParaFiltro,
} from "../../modules/dashboard/dashboard.service.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";

export async function rotasDeDashboard(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirAutenticacao);

  app.get("/", async (request) => {
    const usuario = usuarioDe(request);
    // "Hoje", "próximos 7 dias" e os dias do período dependem do fuso do perfil.
    const hoje = hojeNoFuso(usuario.timezone);

    const dia = z.string().refine(ehDataValida, { message: "Data inválida." });
    const filtros = z
      .object({
        escopo: z.enum(["MINHAS", "TODAS"]).optional(),
        projectId: z.string().uuid().optional(),
        // Sem `de` e `ate`, vale todo o período.
        de: dia.optional(),
        ate: dia.optional(),
      })
      .refine((f) => !f.de === !f.ate, {
        message: "Informe o início e o fim do período.",
      })
      .refine((f) => !f.de || !f.ate || f.de <= f.ate, {
        message: "O início do período precisa vir antes do fim.",
      })
      .parse(request.query);

    // O período não passa de hoje. A tela calcula "hoje" no fuso do navegador,
    // que perto da meia-noite pode estar um dia à frente do fuso do perfil:
    // em vez de recusar, o fim (e, se preciso, o início) é trazido para hoje.
    if (filtros.de && filtros.ate && filtros.ate > hoje) {
      filtros.ate = hoje;
      if (filtros.de > hoje) filtros.de = hoje;
    }

    return montarDashboard(usuario.id, usuario.timezone, filtros);
  });

  app.get("/projetos", async (request) => {
    return projetosParaFiltro(usuarioDe(request).id);
  });
}
