import type { FastifyRequest } from "fastify";

/**
 * Better Auth trabalha com os tipos web padrão (Request/Headers/Response), e o
 * Fastify com os do Node. Estas funções fazem a ponte entre os dois mundos.
 */

export function paraHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [chave, valor] of Object.entries(request.headers)) {
    if (valor === undefined) continue;
    if (Array.isArray(valor)) {
      for (const item of valor) headers.append(chave, item);
    } else {
      headers.append(chave, String(valor));
    }
  }
  return headers;
}

/** Cabeçalhos de IP que o cliente pode forjar à vontade. */
const CABECALHOS_DE_IP = ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "true-client-ip"];

export function paraRequestWeb(request: FastifyRequest): Request {
  const host = request.headers.host ?? "localhost";
  const url = new URL(request.url, `${request.protocol}://${host}`);

  // O Better Auth usa o IP para o rate limit e o grava na sessão. Ele lê
  // X-Forwarded-For, que o cliente controla: trocando o valor a cada
  // tentativa, escaparia do limite de login. Por isso o cabeçalho é refeito
  // com o IP que o Fastify já resolveu, confiando só nos proxies declarados
  // em TRUST_PROXY_HOPS.
  const headers = paraHeaders(request);
  for (const nome of CABECALHOS_DE_IP) headers.delete(nome);
  headers.set("x-forwarded-for", request.ip);

  const temCorpo = !["GET", "HEAD"].includes(request.method);
  return new Request(url.toString(), {
    method: request.method,
    headers,
    body: temCorpo && request.body ? JSON.stringify(request.body) : undefined,
  });
}
