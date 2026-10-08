import { TaskStatus } from "@prisma/client";
import { daquiADias, dataPura, hojeNoFuso } from "../../lib/datas.js";
import { prisma } from "../../lib/prisma.js";
import { notificar } from "../notifications/notifications.service.js";
import { sincronizarGoogle } from "../integrations/google/sincronizacao.js";
import { purgarLixeiraAntiga } from "../trash/trash.service.js";

/**
 * Tarefas agendadas, disparadas pelo cron do host.
 *
 * Rodam sem usuário logado, então não há verificação de permissão aqui: quem
 * protege é a rota, por segredo compartilhado. Em troca, tudo o que elas fazem
 * precisa ser idempotente — o agendador pode repetir a chamada.
 */

const STATUS_ATIVOS: TaskStatus[] = [
  TaskStatus.A_FAZER,
  TaskStatus.EM_ANDAMENTO,
  TaskStatus.EM_REVISAO,
];

/**
 * Avisa quem é responsável por tarefa que vence hoje — e, no dia seguinte,
 * se ela ainda estiver ativa, que ficou atrasada.
 *
 * O "hoje" é o de cada pessoa: às 22h em São Paulo já é o dia seguinte em
 * Tóquio, e o aviso precisa chegar no dia certo de quem recebe. Por isso os
 * usuários são agrupados por fuso.
 */
export async function avisarVencimentos() {
  const fusos = await prisma.user.groupBy({
    by: ["timezone"],
    where: { anonymizedAt: null },
  });

  let enviadas = 0;

  for (const { timezone } of fusos) {
    enviadas += await avisarTarefasDoDia(timezone, hojeNoFuso(timezone), "TAREFA_VENCENDO");
    // O atraso é avisado uma vez só, no dia seguinte ao vencimento: um aviso
    // por dia de atraso viraria ruído.
    enviadas += await avisarTarefasDoDia(timezone, daquiADias(timezone, -1), "TAREFA_ATRASADA");
  }

  return { fusosProcessados: fusos.length, avisosGerados: enviadas };
}

async function avisarTarefasDoDia(
  timezone: string,
  dia: string,
  tipo: "TAREFA_VENCENDO" | "TAREFA_ATRASADA",
): Promise<number> {
  const tarefas = await prisma.task.findMany({
    where: {
      deletedAt: null,
      project: { deletedAt: null },
      status: { in: STATUS_ATIVOS },
      dueDate: dataPura(dia),
      assignees: { some: { user: { timezone, anonymizedAt: null } } },
    },
    select: {
      id: true,
      title: true,
      project: { select: { name: true } },
      assignees: {
        select: { user: { select: { id: true, timezone: true } } },
      },
    },
  });

  let enviadas = 0;
  for (const tarefa of tarefas) {
    for (const { user } of tarefa.assignees) {
      if (user.timezone !== timezone) continue;

      // A chave inclui a data: o aviso sai uma vez por tarefa e por dia,
      // mesmo que o agendador rode de cinco em cinco minutos.
      await notificar({
        userId: user.id,
        type: tipo,
        payload: {
          taskId: tarefa.id,
          taskTitle: tarefa.title,
          projectName: tarefa.project.name,
          dueDate: dia,
        },
        dedupeKey: `${tipo === "TAREFA_VENCENDO" ? "vencimento" : "atraso"}:${tarefa.id}:${dia}`,
      });
      enviadas++;
    }
  }
  return enviadas;
}

/** Apaga de vez o que está na Lixeira há mais de 30 dias. */
export async function limparLixeira() {
  return purgarLixeiraAntiga();
}

/** Marca convites que passaram do prazo, para sumirem das listas. */
export async function expirarConvites() {
  const { count } = await prisma.invitation.updateMany({
    where: { status: "PENDENTE", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRADO" },
  });
  return { convitesExpirados: count };
}

/** Executa todas as rotinas, na ordem em que o agendador as chama. */
export async function rodarRotinas() {
  const vencimentos = await avisarVencimentos();
  const lixeira = await limparLixeira();
  const convites = await expirarConvites();
  // Reenvia ao Google Agenda o que falhou (Google fora do ar, por exemplo).
  const googleAgenda = await sincronizarGoogle();

  return { vencimentos, lixeira, convites, googleAgenda, executadoEm: new Date().toISOString() };
}
