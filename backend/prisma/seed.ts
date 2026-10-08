import { env, isProduction } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { gerarHashDeSenha } from "../src/lib/password.js";
import { criarCaixaDeEntrada } from "../src/modules/projects/inbox.js";

/**
 * Semente de desenvolvimento: cria uma conta pronta para uso.
 *
 * Serve para destravar o acesso local quando o e-mail de verificação não chega
 * — o Resend só entrega para o dono da conta enquanto não houver um domínio
 * verificado, e sem confirmar o endereço o login por senha é recusado.
 *
 * A conta é gravada exatamente como o Better Auth gravaria: o hash sai do
 * mesmo módulo usado no login (`lib/password.ts`), e a credencial vai para
 * `accounts` com `providerId = "credential"` e `accountId` igual ao id do
 * usuário. Fosse diferente, a senha semeada não autenticaria.
 *
 * As credenciais vêm do ambiente, e não do código, para não ficarem fixas no
 * repositório: SEED_USER_EMAIL, SEED_USER_PASSWORD e SEED_USER_NAME.
 */

const PROVEDOR_DE_CREDENCIAL = "credential";

async function main() {
  // Uma conta com senha conhecida e e-mail já verificado é conveniência de
  // desenvolvimento; em produção seria uma porta aberta.
  if (isProduction) {
    throw new Error(
      "A semente não roda em produção: ela cria uma conta com senha conhecida.",
    );
  }

  const email = env.SEED_USER_EMAIL?.trim().toLowerCase();
  const senha = env.SEED_USER_PASSWORD;

  if (!email || !senha) {
    console.info(
      [
        "",
        "Nenhuma conta semeada: defina as variáveis no backend/.env",
        "",
        '  SEED_USER_EMAIL="voce@exemplo.com"',
        '  SEED_USER_PASSWORD="uma-senha-de-8-ou-mais"',
        '  SEED_USER_NAME="Seu Nome"',
        "",
        `Banco acessível. Usuários cadastrados: ${await prisma.user.count()}.`,
        "",
      ].join("\n"),
    );
    return;
  }

  const nome = env.SEED_USER_NAME?.trim() || email.split("@")[0]!;
  const hash = await gerarHashDeSenha(senha);

  const usuario = await prisma.$transaction(async (tx) => {
    // Idempotente: rodar de novo atualiza a senha em vez de falhar por
    // e-mail duplicado — é o que se espera ao trocar a senha no .env.
    const criado = await tx.user.upsert({
      where: { email },
      create: {
        email,
        name: nome,
        // Já verificado: é justamente a etapa que a semente existe para pular.
        emailVerified: true,
      },
      update: { name: nome, emailVerified: true },
    });

    const existente = await tx.account.findFirst({
      where: { userId: criado.id, providerId: PROVEDOR_DE_CREDENCIAL },
      select: { id: true },
    });

    if (existente) {
      await tx.account.update({
        where: { id: existente.id },
        data: { password: hash },
      });
    } else {
      await tx.account.create({
        data: {
          userId: criado.id,
          providerId: PROVEDOR_DE_CREDENCIAL,
          accountId: criado.id,
          password: hash,
        },
      });
    }

    return criado;
  });

  // O gancho que cria a Caixa de entrada pertence ao Better Auth; como a
  // semente escreve direto no banco, ele não dispara e a chamada vem aqui.
  const caixa = await criarCaixaDeEntrada(usuario.id, usuario.name);

  console.info(
    [
      "",
      "Conta de desenvolvimento pronta.",
      `  E-mail:  ${usuario.email}`,
      "  Senha:   (a de SEED_USER_PASSWORD)",
      "  E-mail verificado: sim",
      `  Caixa de entrada: ${caixa.name}`,
      "",
      "Entre em http://localhost:3000/entrar",
      "",
    ].join("\n"),
  );
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
