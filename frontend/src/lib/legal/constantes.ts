/**
 * Dados que aparecem nos documentos legais (Política de privacidade, Política
 * de cookies e Termos de uso). Tudo que muda com o tempo fica aqui, para que
 * os textos não precisem ser editados.
 */

/**
 * Controlador dos dados pessoais (LGPD, art. 5º, VI) e canal de atendimento
 * ao titular (art. 41). Substitua os marcadores antes de publicar.
 */
export const CONTROLADOR = {
  nome: "Alaor Pereira",
  email: "contato.taskon@gmail.com",
} as const;

/**
 * Versão vigente dos documentos (data da última atualização, AAAA-MM-DD).
 * O backend tem a mesma constante em `backend/src/config/legal.ts`, e é ela que
 * decide quando pedir um novo aceite: as duas precisam mudar juntas.
 */
export const VERSAO_DOS_TERMOS = "2026-10-07";

/** Idade mínima para criar uma conta. */
export const IDADE_MINIMA = 18;

/** Prazo, em dias, para responder a um pedido do titular. */
export const PRAZO_DE_RESPOSTA_EM_DIAS = 15;

/**
 * Marca, no sessionStorage, que a pessoa aceitou os termos no /cadastrar antes
 * de seguir para o Google ou o GitHub. Na volta, o app registra o aceite. Fica
 * no sessionStorage, e não na URL de retorno, para que um link de terceiros
 * não consiga registrar um aceite que a pessoa não deu.
 */
export const CHAVE_ACEITE_PENDENTE = "taskon:aceite-pendente";

export interface DocumentoLegal {
  href: "/privacidade" | "/cookies" | "/termos";
  titulo: string;
}

export const DOCUMENTOS = [
  { href: "/privacidade", titulo: "Política de privacidade" },
  { href: "/cookies", titulo: "Política de cookies" },
  { href: "/termos", titulo: "Termos de uso" },
] as const satisfies readonly DocumentoLegal[];
