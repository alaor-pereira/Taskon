import { TaskStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { dadosInvalidos, naoEncontrado } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Perfil do usuário: foto enviada por ele e os números da página "Meu perfil".
 * Nome e senha passam pelo Better Auth (/api/auth/update-user e
 * /api/auth/change-password), não por aqui.
 */

const TIPOS_DE_IMAGEM = ["image/webp", "image/png", "image/jpeg"] as const;
/** A foto chega já recortada em 256×256 pelo navegador; isto é folga. */
export const TAMANHO_MAXIMO_DO_AVATAR = 300 * 1024;

/** Endereço público da foto, com a versão para furar o cache quando ela muda. */
function urlDoAvatar(userId: string, versao: Date): string {
  return `${env.BETTER_AUTH_URL}/api/usuarios/${userId}/avatar?v=${versao.getTime()}`;
}

/**
 * Guarda a foto (data URL em base64) em binário e devolve o endereço que a
 * serve. Quem chama grava esse endereço em `User.image` pelo Better Auth, para
 * a sessão já sair com a foto nova.
 */
export async function salvarAvatar(userId: string, dataUrl: string): Promise<{ url: string }> {
  const partes = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  const mimeType = partes?.[1];
  if (!partes || !mimeType || !(TIPOS_DE_IMAGEM as readonly string[]).includes(mimeType)) {
    throw dadosInvalidos("Envie uma imagem WebP, PNG ou JPEG.");
  }

  const data = Buffer.from(partes[2]!, "base64");
  if (data.length === 0 || data.length > TAMANHO_MAXIMO_DO_AVATAR) {
    throw dadosInvalidos("A imagem precisa ter até 300 KB.");
  }

  const salvo = await prisma.userAvatar.upsert({
    where: { userId },
    create: { userId, data, mimeType },
    update: { data, mimeType },
    select: { updatedAt: true },
  });
  return { url: urlDoAvatar(userId, salvo.updatedAt) };
}

export async function removerAvatar(userId: string): Promise<void> {
  await prisma.userAvatar.deleteMany({ where: { userId } });
}

export async function obterAvatar(userId: string): Promise<{ data: Buffer; mimeType: string }> {
  const avatar = await prisma.userAvatar.findUnique({
    where: { userId },
    select: { data: true, mimeType: true },
  });
  if (!avatar) throw naoEncontrado("Avatar");
  return { data: Buffer.from(avatar.data), mimeType: avatar.mimeType };
}

/**
 * Números e dados de leitura de "Meu perfil".
 *
 * - Tarefas concluídas: aquelas em que a pessoa é responsável, fora da lixeira.
 * - Projetos concluídos: na etapa Concluído, dos quais ela é membro, sem a
 *   Caixa de entrada e fora da lixeira.
 */
export async function resumoDoPerfil(userId: string) {
  const [usuario, tarefasConcluidas, projetosConcluidos, contas] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.task.count({
      where: {
        status: TaskStatus.CONCLUIDO,
        deletedAt: null,
        project: { deletedAt: null },
        assignees: { some: { userId } },
      },
    }),
    prisma.project.count({
      where: {
        status: TaskStatus.CONCLUIDO,
        isInbox: false,
        deletedAt: null,
        members: { some: { userId } },
      },
    }),
    prisma.account.findMany({ where: { userId }, select: { providerId: true } }),
  ]);

  if (!usuario) throw naoEncontrado("Usuário");

  const provedores = [...new Set(contas.map((c) => c.providerId))];
  return {
    tarefasConcluidas,
    projetosConcluidos,
    membroDesde: usuario.createdAt.toISOString(),
    contas: provedores,
    temSenha: provedores.includes("credential"),
  };
}
