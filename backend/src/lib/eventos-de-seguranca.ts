import { log } from "./log.js";

/**
 * Eventos de segurança, num formato só, para serem filtrados no log por
 * `tipo: "seguranca"` e `evento`. Nunca levam senha, token nem e-mail em claro
 * (use `resumoDoEmail` quando precisar correlacionar uma conta sem id).
 */

export type EventoDeSeguranca =
  | "login.sucesso"
  | "login.falha"
  | "login.bloqueado"
  | "login.mfa_pendente"
  | "logout"
  | "senha.alterada"
  | "senha.redefinida"
  | "senha.redefinicao_pedida"
  | "mfa.ativado"
  | "mfa.desativado"
  | "mfa.falha"
  | "mfa.codigos_regenerados"
  | "sessao.encerrada"
  | "conta.excluida"
  | "avatar.recusado"
  | "acesso.negado"
  | "rate_limit.atingido"
  | "integracao.conectada"
  | "integracao.desconectada"
  | "integracao.falha"
  | "cron.nao_autorizado";

/** Os que indicam tentativa de abuso sobem para `warn`. */
const DE_ALERTA = new Set<EventoDeSeguranca>([
  "login.falha",
  "login.bloqueado",
  "mfa.falha",
  "avatar.recusado",
  "acesso.negado",
  "rate_limit.atingido",
  "cron.nao_autorizado",
]);

export interface DadosDoEvento {
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  [extra: string]: unknown;
}

export function registrarEvento(evento: EventoDeSeguranca, dados: DadosDoEvento = {}): void {
  const { userAgent, ...resto } = dados;
  const entrada = {
    tipo: "seguranca",
    evento,
    ...resto,
    // O user-agent vem do cliente: limitado para não inflar nem poluir o log.
    ...(userAgent && { userAgent: userAgent.slice(0, 200) }),
  };
  if (DE_ALERTA.has(evento)) log.warn(entrada, evento);
  else log.info(entrada, evento);
}
