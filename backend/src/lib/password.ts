import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

/**
 * Hash de senha.
 *
 * Vive num módulo próprio porque tem dois consumidores: o Better Auth, no
 * login, e a semente de desenvolvimento, que cria um usuário direto no banco.
 * Se os parâmetros divergissem entre os dois, a senha semeada simplesmente não
 * autenticaria — e o erro apareceria como "senha inválida", sem pista da causa.
 */

/**
 * `Algorithm.Argon2id` vale 2. O enum de @node-rs/argon2 é um const enum
 * ambiente, que não pode ser importado com `verbatimModuleSyntax`, por isso o
 * valor aparece aqui literalmente.
 */
const ARGON2ID = 2;

/**
 * Parâmetros conforme a recomendação da OWASP (m=19 MiB, t=2, p=1).
 * Alterá-los invalida os hashes já gravados, então qualquer ajuste exige uma
 * estratégia de reidratação no login.
 */
export const OPCOES_ARGON = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const gerarHashDeSenha = (senha: string): Promise<string> =>
  argonHash(senha, OPCOES_ARGON);

export const conferirSenha = (hash: string, senha: string): Promise<boolean> =>
  argonVerify(hash, senha);
