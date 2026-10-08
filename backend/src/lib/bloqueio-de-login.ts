/**
 * Limite de tentativas de login por conta.
 *
 * O rate limit do Better Auth conta por IP, o que não segura um ataque
 * espalhado por muitos IPs contra a mesma conta. Aqui a conta é o e-mail
 * digitado: depois de muitas falhas seguidas, novas tentativas por senha são
 * recusadas por um tempo.
 *
 * O travamento é curto de propósito: um atacante também pode usá-lo para
 * incomodar alguém, e o dono da conta continua podendo entrar pelo login
 * social ou redefinir a senha.
 *
 * Fica em memória porque o backend roda em uma instância só. Com mais de uma,
 * isto precisaria ir para um armazenamento compartilhado.
 */

export const MAXIMO_DE_FALHAS = 10;
export const JANELA_MS = 15 * 60 * 1000;

const falhasPorConta = new Map<string, number[]>();

const chave = (email: string) => email.trim().toLowerCase();

function recentes(conta: string, agora: number): number[] {
  const lista = (falhasPorConta.get(conta) ?? []).filter((t) => agora - t < JANELA_MS);
  if (lista.length === 0) falhasPorConta.delete(conta);
  else falhasPorConta.set(conta, lista);
  return lista;
}

export function contaBloqueada(email: string, agora = Date.now()): boolean {
  return recentes(chave(email), agora).length >= MAXIMO_DE_FALHAS;
}

export function registrarFalha(email: string, agora = Date.now()): void {
  const conta = chave(email);
  falhasPorConta.set(conta, [...recentes(conta, agora), agora]);
}

export function limparFalhas(email: string): void {
  falhasPorConta.delete(chave(email));
}

/** Só para os testes. */
export function zerarBloqueios(): void {
  falhasPorConta.clear();
}

// Sem isto, contas que pararam de ser atacadas ficariam no mapa para sempre.
const faxina = setInterval(() => {
  const agora = Date.now();
  for (const conta of falhasPorConta.keys()) recentes(conta, agora);
}, JANELA_MS);
faxina.unref();
