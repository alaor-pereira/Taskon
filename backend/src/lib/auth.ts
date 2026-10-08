import { TermsAcceptanceOrigin } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { z } from "zod";
import { conferirSenha, gerarHashDeSenha } from "./password.js";
import { env, isTest, socialProviders } from "../config/env.js";
import { prisma } from "./prisma.js";
import { enviarEmail, layoutEmail } from "./mailer.js";
import { contaBloqueada, limparFalhas, registrarFalha } from "./bloqueio-de-login.js";
import { registrarEvento, type EventoDeSeguranca } from "./eventos-de-seguranca.js";
import { resumoDoEmail } from "./log.js";
import { senhaVazada } from "./senhas-vazadas.js";
import { fusoValido } from "../modules/calendar/timezone.js";
import { criarCaixaDeEntrada } from "../modules/projects/inbox.js";
import { vincularConvitesPendentes } from "../modules/invitations/invitations.service.js";
import { registrarAceite } from "../modules/terms/terms.service.js";

/** Cadastro por e-mail e senha: o único caminho que traz o checkbox de aceite. */
const CADASTRO_POR_EMAIL = "/sign-up/email";
const LOGIN_POR_SENHA = "/sign-in/email";

/**
 * IP do cliente. O backend refaz o X-Forwarded-For com o IP já resolvido pelo
 * Fastify (ver `paraRequestWeb`), então aqui ele é confiável.
 */
function ipDa(headers: Headers | undefined): string | null {
  return headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

type ContextoDoHook = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

function origemDe(ctx: ContextoDoHook) {
  const headers = ctx.request?.headers ?? ctx.headers;
  return { ip: ipDa(headers), userAgent: headers?.get("user-agent") ?? null };
}

const emailDoCorpo = (ctx: ContextoDoHook) => {
  const email = (ctx.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email : null;
};

/** A única foto aceita é a servida pelo próprio backend para o próprio usuário. */
const prefixoDoAvatar = (userId: string) => `${env.BETTER_AUTH_URL}/api/usuarios/${userId}/avatar?v=`;

/** Eventos registrados quando estes endpoints terminam sem erro. */
const EVENTO_DE_SUCESSO: Record<string, EventoDeSeguranca> = {
  "/sign-out": "logout",
  "/change-password": "senha.alterada",
  "/reset-password": "senha.redefinida",
  "/request-password-reset": "senha.redefinicao_pedida",
  "/revoke-session": "sessao.encerrada",
  "/revoke-sessions": "sessao.encerrada",
  "/revoke-other-sessions": "sessao.encerrada",
  "/two-factor/disable": "mfa.desativado",
  "/two-factor/generate-backup-codes": "mfa.codigos_regenerados",
};

/** Onde uma senha nova é escolhida, e o campo que a traz. */
const SENHA_NOVA_EM: Record<string, "password" | "newPassword"> = {
  "/sign-up/email": "password",
  "/change-password": "newPassword",
  "/reset-password": "newPassword",
};

/** Segundo fator confirmado, no login ou na ativação. */
const VERIFICACAO_DE_MFA = new Set(["/two-factor/verify-totp", "/two-factor/verify-backup-code"]);

export const auth = betterAuth({
  appName: "Taskon",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  trustedOrigins: [env.FRONTEND_URL],

  emailAndPassword: {
    enabled: true,
    // Sem e-mail confirmado, não há login por senha.
    requireEmailVerification: true,
    minPasswordLength: 8,
    // Quem redefine a senha pode estar expulsando um invasor: todas as
    // sessões abertas caem junto.
    revokeSessionsOnPasswordReset: true,
    password: {
      // O mesmo par usado pela semente de desenvolvimento, para que uma conta
      // criada direto no banco consiga autenticar aqui.
      hash: (password) => gerarHashDeSenha(password),
      verify: ({ hash, password }) => conferirSenha(hash, password),
    },
    sendResetPassword: async ({ user, url }) => {
      await enviarEmail({
        to: user.email,
        subject: "Redefinir sua senha no Taskon",
        text: `Para redefinir sua senha, acesse: ${url}\n\nSe você não pediu isso, ignore esta mensagem.`,
        html: layoutEmail(
          "Redefinir sua senha",
          "<p>Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora.</p><p>Se você não pediu isso, ignore esta mensagem: sua senha continua a mesma.</p>",
          { texto: "Redefinir senha", url },
        ),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await enviarEmail({
        to: user.email,
        subject: "Confirme seu e-mail no Taskon",
        text: `Confirme seu e-mail para ativar sua conta: ${url}`,
        html: layoutEmail(
          "Confirme seu e-mail",
          "<p>Falta um passo para ativar sua conta no Taskon. Confirme que este endereço é seu.</p>",
          { texto: "Confirmar e-mail", url },
        ),
      });
    },
  },

  socialProviders: {
    ...(socialProviders.google && {
      google: {
        clientId: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
      },
    }),
    ...(socialProviders.github && {
      github: {
        clientId: env.GITHUB_CLIENT_ID!,
        clientSecret: env.GITHUB_CLIENT_SECRET!,
      },
    }),
  },

  account: {
    // Tokens do Google/GitHub ficam cifrados no banco (chave derivada de
    // BETTER_AUTH_SECRET): um vazamento do banco não entrega acesso às
    // contas externas. Os já gravados em claro são trocados no próximo login.
    encryptOAuthTokens: true,
    accountLinking: {
      // Unir contas pelo mesmo e-mail só é seguro quando o provedor afirma que
      // o endereço foi verificado. Sem isso, bastaria criar uma conta social com
      // o e-mail de outra pessoa para assumir a conta dela.
      enabled: true,
      trustedProviders: ["google", "github"],
      allowDifferentEmails: false,
    },
  },

  user: {
    additionalFields: {
      timezone: {
        type: "string",
        required: false,
        defaultValue: "America/Sao_Paulo",
        input: true,
        // Um fuso que o Intl não conhece derrubaria a agenda com erro 500.
        validator: {
          input: z.string().max(64).refine(fusoValido, "Fuso horário desconhecido."),
        },
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 dias
    updateAge: 60 * 60 * 24, // renova no máximo uma vez por dia
    // O cache evita ir ao banco a cada requisição, mas uma sessão encerrada
    // (logout, exclusão de conta, "encerrar sessão") continua valendo até ele
    // vencer. Um minuto mantém essa janela curta.
    cookieCache: { enabled: true, maxAge: 60 },
  },

  /**
   * Por IP, em memória (o backend roda em uma instância só). Os limites por
   * rota valem para as tentativas de adivinhar senha ou código e para os
   * envios de e-mail; o limite por conta fica em `bloqueio-de-login.ts`.
   */
  rateLimit: {
    enabled: !isTest,
    storage: "memory",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 300, max: 3 },
      "/send-verification-email": { window: 300, max: 3 },
      "/change-password": { window: 60, max: 5 },
      "/two-factor/*": { window: 60, max: 5 },
    },
  },

  advanced: {
    database: {
      // Por padrão o Better Auth gera identificadores no estilo nanoid
      // ("uKx3..."), que o PostgreSQL recusa nas colunas declaradas como uuid.
      // Como todo o schema do Taskon usa uuid — inclusive as chaves
      // estrangeiras que apontam para users.id —, é o gerador que se alinha ao
      // banco, e não o contrário.
      generateId: "uuid",
    },
    // Refeito pelo backend com o IP resolvido pelo Fastify (ver headers.ts).
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    // Backend e frontend vivem em origens distintas, então o cookie de sessão
    // precisa viajar entre elas. Em produção isso exige HTTPS nas duas pontas.
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      httpOnly: true,
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Sem aceite, a conta nem chega a ser criada. Fica aqui, e não no hook
      // do banco, porque com a verificação de e-mail obrigatória um endereço
      // já cadastrado recebe uma resposta genérica sem passar pela criação.
      if (ctx.path === CADASTRO_POR_EMAIL) {
        if ((ctx.body as { aceiteDosTermos?: unknown } | undefined)?.aceiteDosTermos !== true) {
          throw new APIError("BAD_REQUEST", {
            message: "Aceite os Termos de uso e a Política de privacidade para criar a conta.",
          });
        }
      }

      // Senha que já circula em vazamentos é a primeira a ser testada em
      // ataques de credenciais. Se o serviço de consulta falhar, a senha passa.
      const campoDaSenha = SENHA_NOVA_EM[ctx.path];
      if (campoDaSenha) {
        const senha = (ctx.body as Record<string, unknown> | undefined)?.[campoDaSenha];
        if (typeof senha === "string" && (await senhaVazada(senha)) === true) {
          throw new APIError("BAD_REQUEST", {
            message: "Esta senha aparece em vazamentos de dados conhecidos. Escolha outra.",
          });
        }
        return;
      }

      // Muitas falhas na mesma conta, venham de onde vierem: recusa sem
      // conferir a senha. A mensagem não diz se a conta existe.
      if (ctx.path === LOGIN_POR_SENHA) {
        const email = emailDoCorpo(ctx);
        if (email && contaBloqueada(email)) {
          registrarEvento("login.bloqueado", { conta: resumoDoEmail(email), ...origemDe(ctx) });
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Muitas tentativas. Tente de novo em alguns minutos.",
          });
        }
        return;
      }

      // A foto vem do cliente no /update-user. Sem esta guarda, qualquer URL
      // externa viraria um pixel de rastreamento carregado por quem visse o
      // nome da pessoa no sistema.
      if (ctx.path === "/update-user") {
        const corpo = ctx.body as { image?: unknown } | undefined;
        if (!corpo || !("image" in corpo) || corpo.image === null) return;
        const sessao = await getSessionFromCtx(ctx);
        const permitida =
          sessao && typeof corpo.image === "string" && corpo.image.startsWith(prefixoDoAvatar(sessao.user.id));
        if (!permitida) {
          registrarEvento("avatar.recusado", { userId: sessao?.user.id, ...origemDe(ctx) });
          throw new APIError("BAD_REQUEST", { message: "Envie a foto pelo próprio Taskon." });
        }
      }
    }),

    after: createAuthMiddleware(async (ctx) => {
      const retorno = ctx.context.returned;
      const falhou = isAPIError(retorno);

      if (ctx.path === LOGIN_POR_SENHA) {
        const email = emailDoCorpo(ctx);
        if (!email) return;
        if (falhou) {
          // Só senha errada conta como tentativa; 429 e e-mail não verificado não.
          if (retorno.statusCode === 401) {
            registrarFalha(email);
            registrarEvento("login.falha", { conta: resumoDoEmail(email), ...origemDe(ctx) });
          }
          return;
        }
        limparFalhas(email);
        const usuario = ctx.context.newSession?.user as { id: string; twoFactorEnabled?: boolean } | undefined;
        // Com verificação em duas etapas, a senha certa ainda não é o login:
        // o plugin (que roda depois deste hook) troca a sessão por um pedido
        // de código. O sucesso é registrado quando o código for confirmado.
        registrarEvento(usuario?.twoFactorEnabled ? "login.mfa_pendente" : "login.sucesso", {
          userId: usuario?.id ?? null,
          metodo: "senha",
          ...origemDe(ctx),
        });
        return;
      }

      if (VERIFICACAO_DE_MFA.has(ctx.path)) {
        // No login não há sessão ainda (só o cookie do segundo fator); na
        // ativação, quem confirma o primeiro código já está logado.
        const naAtivacao = Boolean(ctx.request?.headers.get("cookie")?.includes("session_token"));
        const userId = ctx.context.newSession?.user.id ?? ctx.context.session?.user.id ?? null;
        if (falhou) registrarEvento("mfa.falha", { userId, ...origemDe(ctx) });
        else if (naAtivacao) registrarEvento("mfa.ativado", { userId, ...origemDe(ctx) });
        else registrarEvento("login.sucesso", { userId, metodo: "senha+mfa", ...origemDe(ctx) });
        return;
      }

      if (falhou) return;

      if (ctx.path.startsWith("/callback/") && ctx.context.newSession) {
        registrarEvento("login.sucesso", {
          userId: ctx.context.newSession.user.id,
          metodo: ctx.path.slice("/callback/".length),
          ...origemDe(ctx),
        });
        return;
      }

      const evento = EVENTO_DE_SUCESSO[ctx.path];
      if (evento) {
        registrarEvento(evento, { userId: ctx.context.session?.user.id ?? null, ...origemDe(ctx) });
      }
    }),
  },

  plugins: [
    // Verificação em duas etapas por aplicativo autenticador (TOTP), com
    // códigos de backup. Opcional, ativada em Meu perfil, e só para quem entra
    // por senha: o login pelo Google/GitHub já passa pelo 2FA do provedor.
    // Ativar exige a senha e confirmar o primeiro código.
    twoFactor({
      issuer: "Taskon",
      skipVerificationOnEnable: false,
      accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 15 * 60 },
    }),
  ],

  databaseHooks: {
    user: {
      create: {
        after: async (user, ctx) => {
          // Toda tarefa pertence a um projeto. A Caixa de entrada garante que
          // exista destino para a tarefa criada sem escolher projeto.
          await criarCaixaDeEntrada(user.id, user.name);

          // Convites enviados antes de a conta existir ficam gravados só pelo
          // e-mail; agora passam a apontar para o usuário e aparecem na lista.
          await vincularConvitesPendentes(user.id, user.email);

          // A prova do aceite dado no cadastro. Contas criadas pelo login
          // social não passam pelo checkbox: o app pede o aceite na entrada.
          if (ctx?.path === CADASTRO_POR_EMAIL) {
            const headers = ctx.request?.headers ?? ctx.headers;
            await registrarAceite(user.id, TermsAcceptanceOrigin.CADASTRO, {
              ip: ipDa(headers),
              userAgent: headers?.get("user-agent"),
            });
          }
        },
      },
    },
  },
});

export type Sessao = typeof auth.$Infer.Session;
