import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Tokens de uso único (convites).
 *
 * O banco guarda só o hash. Se o banco vazar, os tokens não são reutilizáveis —
 * é o mesmo raciocínio aplicado a senhas, ainda que aqui a vida útil seja curta.
 */

export interface TokenGerado {
  /** Vai no link do e-mail. Só existe neste instante; não é recuperável depois. */
  valor: string;
  /** O que é gravado. */
  hash: string;
}

export function gerarToken(): TokenGerado {
  const valor = randomBytes(32).toString("base64url");
  return { valor, hash: hashToken(valor) };
}

export function hashToken(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

/**
 * Comparação em tempo constante. Comparar com `===` vazaria informação pelo
 * tempo de resposta, permitindo descobrir o token caractere a caractere.
 */
export function tokensConferem(recebido: string, hashGravado: string): boolean {
  const a = Buffer.from(hashToken(recebido), "hex");
  const b = Buffer.from(hashGravado, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Convites expiram em 7 dias. */
export const DIAS_PARA_EXPIRAR_CONVITE = 7;

export function dataDeExpiracaoDeConvite(base = new Date()): Date {
  const data = new Date(base);
  data.setDate(data.getDate() + DIAS_PARA_EXPIRAR_CONVITE);
  return data;
}
