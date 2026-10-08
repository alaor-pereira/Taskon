import { createHash } from "node:crypto";
import { isTest } from "../config/env.js";
import { log } from "./log.js";

/**
 * Consulta se uma senha aparece em vazamentos conhecidos (Have I Been Pwned).
 *
 * Por k-anonimato: só os 5 primeiros caracteres do SHA-1 da senha saem do
 * servidor; a resposta traz centenas de sufixos e a comparação é feita aqui.
 * O cabeçalho `Add-Padding` faz a resposta ter tamanho parecido sempre, para
 * nem o tamanho revelar algo.
 *
 * Falha aberta: se o serviço não responder a tempo, devolve `null` e o
 * cadastro segue. Uma indisponibilidade externa não pode impedir as pessoas
 * de criar conta ou trocar a senha.
 */

const TEMPO_LIMITE_MS = 3000;

export async function senhaVazada(senha: string): Promise<boolean | null> {
  if (isTest) return false;

  const hash = createHash("sha1").update(senha).digest("hex").toUpperCase();
  const prefixo = hash.slice(0, 5);
  const sufixo = hash.slice(5);

  try {
    const resposta = await fetch(`https://api.pwnedpasswords.com/range/${prefixo}`, {
      headers: { "Add-Padding": "true", "User-Agent": "Taskon" },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    for (const linha of (await resposta.text()).split(/\r?\n/)) {
      const [sufixoDaLinha, contagem] = linha.split(":");
      // Linhas de enchimento vêm com contagem 0.
      if (sufixoDaLinha === sufixo && Number(contagem) > 0) return true;
    }
    return false;
  } catch (erro) {
    log.warn({ err: erro }, "Não foi possível consultar senhas vazadas; a senha foi aceita");
    return null;
  }
}
