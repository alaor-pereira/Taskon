import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { env } from "../../config/env.js";
import { rodarRotinas } from "../../modules/cron/jobs.service.js";
import { naoAutenticado } from "../../lib/errors.js";
import { registrarEvento } from "../../lib/eventos-de-seguranca.js";

/**
 * Rotinas agendadas.
 *
 * Não há usuário logado aqui, então a proteção é um segredo compartilhado com
 * o agendador do host. Sem `CRON_SECRET` configurado, as rotas ficam
 * desligadas: deixá-las abertas permitiria que qualquer um disparasse a purga
 * da Lixeira.
 */
export async function rotasDeCron(app: FastifyInstance): Promise<void> {
  if (!env.CRON_SECRET) {
    app.log.warn(
      "CRON_SECRET não configurado: as rotinas agendadas ficam desligadas.",
    );
    return;
  }

  app.post("/rodar", { preHandler: exigirSegredo }, async () => {
    return rodarRotinas();
  });
}

function exigirSegredo(request: FastifyRequest, _reply: unknown, done: () => void) {
  const cabecalho = request.headers.authorization ?? "";
  const recebido = cabecalho.replace(/^Bearer\s+/i, "");

  if (!conferem(recebido, env.CRON_SECRET!)) {
    registrarEvento("cron.nao_autorizado", {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    throw naoAutenticado();
  }
  done();
}

/** Comparação em tempo constante: `===` vazaria o segredo pelo tempo de resposta. */
function conferem(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
