import { NotificationType, Prisma } from "@prisma/client";
import { dadosInvalidos } from "../../lib/errors.js";
import { prisma, type PrismaTx } from "../../lib/prisma.js";
import { chaveDaNotificacao, ehChaveConfiguravel } from "./notification-keys.js";

/**
 * Notificações dentro do aplicativo.
 *
 * O MVP não envia e-mail para estes avisos: a única mensagem que sai por e-mail
 * é o convite a quem ainda não tem conta.
 */

interface NovaNotificacao {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  /**
   * Chave de deduplicação. Impede repetir o mesmo aviso — por exemplo, avisar
   * duas vezes que a mesma tarefa vence hoje. Sem chave, cada chamada cria uma
   * notificação nova.
   */
  dedupeKey?: string;
}

/** Se a pessoa desligou este aviso em Configurações > Notificações. */
async function desligou(
  userId: string,
  chave: string,
  db: PrismaTx,
): Promise<boolean> {
  if (!ehChaveConfiguravel(chave)) return false;
  const preferencia = await db.notificationPreference.findUnique({
    where: { userId_chave: { userId, chave } },
    select: { userId: true },
  });
  return Boolean(preferencia);
}

export async function notificar(
  nova: NovaNotificacao,
  db: PrismaTx = prisma,
): Promise<void> {
  // Aviso desligado não é criado: a escolha é só de quem o receberia.
  if (await desligou(nova.userId, chaveDaNotificacao(nova.type, nova.payload), db)) return;

  // `createMany` com `skipDuplicates` em vez de `create` dentro de try/catch:
  // a repetição é o caso normal — o agendador roda de poucos em poucos
  // minutos —, e tratá-la como exceção encheria o log de erros esperados.
  await db.notification.createMany({
    data: [
      {
        userId: nova.userId,
        type: nova.type,
        payload: nova.payload as Prisma.InputJsonValue,
        dedupeKey: nova.dedupeKey ?? null,
      },
    ],
    skipDuplicates: true,
  });
}

/** Notifica várias pessoas do mesmo fato, pulando o próprio autor. */
export async function notificarVarios(
  userIds: string[],
  base: Omit<NovaNotificacao, "userId">,
  excetoId?: string,
  db: PrismaTx = prisma,
): Promise<void> {
  const destinatarios = [...new Set(userIds)].filter((id) => id !== excetoId);
  for (const userId of destinatarios) {
    await notificar({ ...base, userId }, db);
  }
}

/**
 * Nome de quem agiu, para o texto do aviso ("Ana atribuiu…"). Vai no payload:
 * a notificação continua legível mesmo que a pessoa mude de nome ou saia.
 */
export async function nomeDoAutor(
  userId: string,
  db: PrismaTx = prisma,
): Promise<string | null> {
  const autor = await db.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  return autor?.name ?? null;
}

/**
 * Avisa que uma tarefa recebeu comentário, agrupando enquanto não lido.
 *
 * Se a pessoa ainda tem um aviso não lido de comentários naquela tarefa, ele é
 * atualizado — conta mais um, guarda o autor mais recente e volta ao topo —
 * em vez de empilhar um aviso por comentário. Depois de lido, o próximo
 * comentário abre um aviso novo.
 */
export async function notificarComentariosAgrupados(
  userIds: string[],
  dados: {
    taskId: string;
    taskTitle: string;
    projectName: string;
    autorNome: string | null;
  },
  excetoId?: string,
  db: PrismaTx = prisma,
): Promise<void> {
  const destinatarios = [...new Set(userIds)].filter((id) => id !== excetoId);

  for (const userId of destinatarios) {
    if (await desligou(userId, NotificationType.COMENTARIO_NA_TAREFA, db)) continue;

    const aberto = await db.notification.findFirst({
      where: {
        userId,
        type: NotificationType.COMENTARIO_NA_TAREFA,
        readAt: null,
        payload: { path: ["taskId"], equals: dados.taskId },
      },
      select: { id: true, payload: true },
    });

    if (aberto) {
      const anterior = aberto.payload as { quantidade?: number };
      await db.notification.update({
        where: { id: aberto.id },
        data: {
          payload: { ...dados, quantidade: (anterior.quantidade ?? 1) + 1 },
          createdAt: new Date(),
        },
      });
    } else {
      await notificar(
        {
          userId,
          type: NotificationType.COMENTARIO_NA_TAREFA,
          payload: { ...dados, quantidade: 1 },
        },
        db,
      );
    }
  }
}

export async function listarNotificacoes(
  userId: string,
  opcoes: { apenasNaoLidas?: boolean; limite?: number } = {},
) {
  return prisma.notification.findMany({
    where: {
      userId,
      ...(opcoes.apenasNaoLidas && { readAt: null }),
    },
    orderBy: { createdAt: "desc" },
    take: opcoes.limite ?? 30,
  });
}

export async function contarNaoLidas(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function marcarComoLida(
  userId: string,
  notificationId: string,
): Promise<void> {
  // O filtro por userId é a autorização: ninguém marca a notificação de outro.
  await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function marcarTodasComoLidas(userId: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}

// --- Preferências -----------------------------------------------------------

/** Chaves que o usuário desligou. */
export async function obterNotificacoesDesativadas(userId: string): Promise<string[]> {
  const linhas = await prisma.notificationPreference.findMany({
    where: { userId },
    select: { chave: true },
    orderBy: { chave: "asc" },
  });
  return linhas.map((l) => l.chave);
}

/**
 * Substitui o conjunto de avisos desligados do usuário. Só aceita chaves da
 * lista configurável — o convite para equipe, por exemplo, não pode sair.
 */
export async function definirNotificacoesDesativadas(
  userId: string,
  chaves: string[],
): Promise<void> {
  const unicas = [...new Set(chaves)];
  const invalidas = unicas.filter((c) => !ehChaveConfiguravel(c));
  if (invalidas.length > 0) {
    throw dadosInvalidos("Há avisos que não podem ser desligados.", { chaves: invalidas });
  }

  await prisma.$transaction([
    prisma.notificationPreference.deleteMany({ where: { userId } }),
    prisma.notificationPreference.createMany({
      data: unicas.map((chave) => ({ userId, chave })),
    }),
  ]);
}
