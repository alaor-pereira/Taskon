import { ProjectRole } from "@prisma/client";
import { prisma, type PrismaTx } from "../../lib/prisma.js";
import { regraDeNegocio } from "../../lib/errors.js";

export const NOME_CAIXA_DE_ENTRADA = "Caixa de entrada";

/**
 * Cria a Caixa de entrada do usuário: o projeto pessoal que recebe tarefas
 * criadas sem escolher projeto. Uma por usuário, nunca excluída nem compartilhada.
 *
 * É idempotente porque roda num gancho de criação de usuário, que pode ser
 * repetido em cenários de retentativa.
 */
export async function criarCaixaDeEntrada(
  userId: string,
  nomeUsuario?: string,
  db: PrismaTx = prisma,
) {
  const existente = await db.project.findFirst({
    where: { ownerId: userId, isInbox: true },
  });
  if (existente) return existente;

  return db.project.create({
    data: {
      name: NOME_CAIXA_DE_ENTRADA,
      description: nomeUsuario
        ? `Tarefas pessoais de ${nomeUsuario}.`
        : "Tarefas pessoais.",
      ownerId: userId,
      isInbox: true,
      // Invariante: o dono é sempre também OWNER em project_members.
      members: { create: { userId, role: ProjectRole.OWNER } },
    },
  });
}

/** Busca a Caixa de entrada, criando-a se ainda não existir. */
export async function obterCaixaDeEntrada(userId: string, db: PrismaTx = prisma) {
  const existente = await db.project.findFirst({
    where: { ownerId: userId, isInbox: true },
  });
  return existente ?? (await criarCaixaDeEntrada(userId, undefined, db));
}

/**
 * A Caixa de entrada é estrutural: sem ela, uma tarefa criada pelo "+" da
 * sidebar não teria destino. Por isso não pode ser excluída nem compartilhada.
 */
export function garantirQueNaoEhCaixaDeEntrada(
  projeto: { isInbox: boolean },
  acao: string,
): void {
  if (projeto.isInbox) {
    throw regraDeNegocio(`A Caixa de entrada não pode ser ${acao}.`);
  }
}
