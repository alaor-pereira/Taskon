/**
 * O campo "local ou link" de uma reunião aceita as duas coisas: uma sala
 * ("Sala 3") ou um endereço de videochamada. Só vira link clicável o que é
 * claramente um endereço web.
 *
 * "meet.google.com/abc-defg-hij", sem protocolo, também conta: é como as
 * pessoas costumam colar. Qualquer protocolo que não seja http(s) — como
 * `javascript:` — é recusado, para o link nunca executar código.
 */
export function urlExterna(valor: string | null | undefined): string | null {
  const texto = valor?.trim();
  if (!texto || /\s/.test(texto)) return null;

  const temProtocolo = /^[a-z][a-z\d+.-]*:/i.test(texto);
  // Sem protocolo, precisa parecer um domínio: "algo.tld" no começo.
  if (!temProtocolo && !/^[\w-]+(\.[\w-]+)+(:\d+)?([/?#]|$)/.test(texto)) return null;

  try {
    const url = new URL(temProtocolo ? texto : `https://${texto}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
