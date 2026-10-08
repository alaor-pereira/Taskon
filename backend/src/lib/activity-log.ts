import { prisma, type PrismaTx } from "./prisma.js";

/**
 * Histórico de alterações.
 *
 * Alimenta três coisas ao mesmo tempo: a "última alteração" do Header, a seção
 * "Recentes" e parte das notificações. Por isso é escrito em toda mudança
 * relevante, sempre pelo backend — o cliente nunca grava aqui, senão o histórico
 * poderia ser forjado.
 */

export type TipoEntidade =
  | "EQUIPE"
  | "PROJETO"
  | "TAREFA"
  | "COMENTARIO"
  | "EVENTO";

export type Acao =
  | "CRIADO"
  | "ATUALIZADO"
  | "EXCLUIDO"
  | "RESTAURADO"
  | "MEMBRO_ADICIONADO"
  | "MEMBRO_REMOVIDO"
  | "PAPEL_ALTERADO"
  | "PROPRIEDADE_TRANSFERIDA"
  | "STATUS_ALTERADO"
  | "RESPONSAVEL_ATRIBUIDO"
  | "RESPONSAVEL_REMOVIDO";

interface RegistroDeAtividade {
  entityType: TipoEntidade;
  entityId: string;
  /** Desnormalizado: permite filtrar "Recentes" pelos projetos acessíveis. */
  projectId?: string | null;
  actorId: string;
  action: Acao;
  before?: unknown;
  after?: unknown;
}

export async function registrarAtividade(
  registro: RegistroDeAtividade,
  db: PrismaTx = prisma,
): Promise<void> {
  await db.activityLog.create({
    data: {
      entityType: registro.entityType,
      entityId: registro.entityId,
      projectId: registro.projectId ?? null,
      actorId: registro.actorId,
      action: registro.action,
      before: toJson(registro.before),
      after: toJson(registro.after),
    },
  });
}

/**
 * O Prisma distingue `null` (gravar NULL) de `undefined` (não gravar coluna).
 * Normalizar aqui evita que um `before` ausente vire NULL por engano.
 */
function toJson(valor: unknown) {
  if (valor === undefined) return undefined;
  return valor as never;
}

/** Última alteração de uma entidade, para o canto direito do Header. */
export async function ultimaAlteracao(
  entityType: TipoEntidade,
  entityId: string,
  db: PrismaTx = prisma,
) {
  const registro = await db.activityLog.findFirst({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { id: true, name: true } } },
  });

  if (!registro) return null;
  return {
    acao: registro.action,
    quando: registro.createdAt,
    por: registro.actor.name,
  };
}
