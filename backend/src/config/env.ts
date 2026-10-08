import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

/**
 * Carrega o `.env` da pasta do backend.
 *
 * Nem o Node nem o tsx fazem isso sozinhos: sem esta chamada, `npm run dev`
 * falharia reclamando de DATABASE_URL mesmo com o arquivo preenchido.
 * `loadEnvFile` não sobrescreve o que já está definido no ambiente, então uma
 * variável passada na linha de comando continua tendo precedência.
 *
 * Em teste o arquivo é ignorado de propósito: a bateria apaga todas as
 * tabelas, e herdar a DATABASE_URL de desenvolvimento destruiria os dados de
 * trabalho. Lá quem manda é TEST_DATABASE_URL, definida em tests/setup.ts.
 */
if (process.env.NODE_ENV !== "test") {
  const arquivo = resolve(process.cwd(), ".env");
  if (existsSync(arquivo)) process.loadEnvFile(arquivo);
}

/**
 * Marca um valor opcional.
 *
 * Num arquivo .env é comum deixar a chave presente e vazia
 * (`RESEND_API_KEY=`) para lembrar que ela existe. Sem este tratamento, a
 * string vazia seria validada como se fosse um valor de verdade e reprovaria
 * em regras como `min(16)`. Vazio aqui significa "não configurado".
 */
const opcional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

/**
 * Variáveis de ambiente validadas na inicialização.
 * Falhar aqui é melhor do que descobrir a falta de um segredo em produção.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),

  DATABASE_URL: z.string().url(),

  /** Segredo de assinatura de sessão. Gere com: openssl rand -base64 32 */
  BETTER_AUTH_SECRET: z.string().min(32),
  /** Origem pública do backend. Usada nos links de verificação e callbacks sociais. */
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3333"),
  /** Origem do frontend. Única origem aceita pelo CORS e destino dos redirecionamentos. */
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  GOOGLE_CLIENT_ID: opcional(z.string()),
  GOOGLE_CLIENT_SECRET: opcional(z.string()),
  GITHUB_CLIENT_ID: opcional(z.string()),
  GITHUB_CLIENT_SECRET: opcional(z.string()),

  /** Sem chave, os e-mails são apenas registrados no console (modo desenvolvimento). */
  RESEND_API_KEY: opcional(z.string()),
  /**
   * O Resend só aceita remetente de domínio verificado. `onboarding@resend.dev`
   * é o remetente de testes que funciona sem verificar domínio, mas entrega
   * apenas para o e-mail dono da conta Resend. Em produção, troque por um
   * endereço de domínio próprio já verificado.
   */
  MAIL_FROM: z.string().default("Taskon <onboarding@resend.dev>"),

  /** Protege os endpoints disparados pelo cron do host. */
  CRON_SECRET: opcional(z.string().min(16)),

  /**
   * Quantos proxies confiáveis ficam na frente do backend (ex.: 1 para um
   * Caddy/Nginx). O IP do cliente é lido de `X-Forwarded-For` pulando só esses
   * saltos; o resto do cabeçalho vem do cliente e não merece confiança. Zero
   * (o padrão) ignora o cabeçalho e usa o IP da conexão.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

  /**
   * Conta de desenvolvimento criada por `npm run db:seed`.
   *
   * Existe para destravar o acesso local quando a verificação por e-mail não
   * chega — o Resend só entrega para o dono da conta enquanto não houver um
   * domínio verificado. A semente recusa rodar em produção.
   */
  SEED_USER_EMAIL: opcional(z.string().email()),
  SEED_USER_PASSWORD: opcional(z.string().min(8)),
  SEED_USER_NAME: opcional(z.string().min(1)),
});

/** O valor de exemplo do `.env.example`: passa no tamanho mínimo, mas é público. */
const SEGREDO_DE_EXEMPLO = "troque-este-valor-por-um-segredo-de-32-caracteres-ou-mais";

/**
 * Em produção, o que em desenvolvimento é conveniência vira falha de
 * segurança: URLs sem HTTPS mandam o cookie de sessão em claro, o segredo de
 * exemplo é público, e sem chave do Resend os links de verificação e de
 * redefinição de senha iriam parar no log.
 */
const schemaComRegrasDeProducao = schema.superRefine((v, ctx) => {
  if (v.NODE_ENV !== "production") return;
  const problema = (path: string, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  if (!v.BETTER_AUTH_URL.startsWith("https://")) problema("BETTER_AUTH_URL", "use https:// em produção");
  if (!v.FRONTEND_URL.startsWith("https://")) problema("FRONTEND_URL", "use https:// em produção");
  if (v.BETTER_AUTH_SECRET === SEGREDO_DE_EXEMPLO) {
    problema("BETTER_AUTH_SECRET", "troque o valor de exemplo por um segredo gerado");
  }
  if (!v.RESEND_API_KEY) problema("RESEND_API_KEY", "obrigatória em produção");
});

const parsed = schemaComRegrasDeProducao.safeParse(process.env);

if (!parsed.success) {
  const detalhes = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");

  const temArquivo = existsSync(resolve(process.cwd(), ".env"));
  const dica = temArquivo
    ? "O arquivo .env foi encontrado, mas não traz tudo o que falta acima. Compare com .env.example."
    : "Não há .env nesta pasta. Copie o modelo: cp .env.example .env";

  throw new Error(`Variáveis de ambiente inválidas:\n${detalhes}\n\n${dica}`);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/** Provedores sociais configurados. Ausentes ficam desligados em vez de quebrar o boot. */
export const socialProviders = {
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
};
