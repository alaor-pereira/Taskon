import { TermsAcceptanceOrigin } from "@prisma/client";
import { VERSAO_DOS_TERMOS } from "../../config/legal.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Aceite dos Termos de uso e ciência da Política de privacidade.
 *
 * Cada aceite vira uma linha nova — nunca se atualiza nem se apaga —, porque o
 * que se precisa provar é quem aceitou qual versão, quando e de onde.
 */

export interface OrigemDaRequisicao {
  ip?: string | null;
  userAgent?: string | null;
}

export async function situacaoDosTermos(userId: string) {
  const aceite = await prisma.termsAcceptance.findFirst({
    where: { userId, version: VERSAO_DOS_TERMOS },
    orderBy: { acceptedAt: "desc" },
    select: { acceptedAt: true },
  });
  return {
    versaoAtual: VERSAO_DOS_TERMOS,
    aceitouEm: aceite?.acceptedAt.toISOString() ?? null,
    precisaAceitar: !aceite,
  };
}

/** Registra o aceite da versão vigente. Aceitar de novo a mesma versão não duplica. */
export async function registrarAceite(
  userId: string,
  origem: TermsAcceptanceOrigin,
  requisicao: OrigemDaRequisicao = {},
): Promise<void> {
  const jaAceitou = await prisma.termsAcceptance.findFirst({
    where: { userId, version: VERSAO_DOS_TERMOS },
    select: { id: true },
  });
  if (jaAceitou) return;

  await prisma.termsAcceptance.create({
    data: {
      userId,
      version: VERSAO_DOS_TERMOS,
      origin: origem,
      ipAddress: requisicao.ip ?? null,
      // O user-agent vem do cliente; o limite evita guardar um texto arbitrário.
      userAgent: requisicao.userAgent?.slice(0, 512) ?? null,
    },
  });
}
