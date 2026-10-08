import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy com nonce por requisição.
 *
 * Só roda script que traga o nonce desta resposta (o Next o aplica aos
 * próprios scripts; o do tema recebe pelo layout). Se um dia um XSS conseguir
 * injetar HTML, o script injetado não executa.
 *
 * `style-src` aceita estilos inline: Base UI e os gráficos posicionam
 * elementos com o atributo `style`, e CSS injetado não executa código.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const desenvolvimento = process.env.NODE_ENV === "development";

/** Fotos de perfil das contas sociais, além das servidas pela própria API. */
const IMAGENS_DE_PROVEDORES = "https://lh3.googleusercontent.com https://avatars.githubusercontent.com";

function politica(nonce: string): string {
  return [
    "default-src 'self'",
    // 'unsafe-eval' só em desenvolvimento: o React usa eval para montar as
    // pilhas de erro do servidor no navegador.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desenvolvimento ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${API} ${IMAGENS_DE_PROVEDORES}`,
    "font-src 'self'",
    // Em desenvolvimento, o recarregamento automático usa WebSocket.
    `connect-src 'self' ${API}${desenvolvimento ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${API}`,
    "frame-ancestors 'none'",
    ...(desenvolvimento ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = politica(nonce);

  // O Next lê o nonce do cabeçalho da requisição ao renderizar.
  const cabecalhos = new Headers(request.headers);
  cabecalhos.set("x-nonce", nonce);
  cabecalhos.set("Content-Security-Policy", csp);

  const resposta = NextResponse.next({ request: { headers: cabecalhos } });
  resposta.headers.set("Content-Security-Policy", csp);
  return resposta;
}

export const config = {
  matcher: [
    {
      // Arquivos estáticos não precisam da política nem de um nonce novo.
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
