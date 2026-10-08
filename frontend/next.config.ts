import type { NextConfig } from "next";

const producao = process.env.NODE_ENV === "production";

/**
 * Cabeçalhos de segurança fixos. A Content-Security-Policy fica em
 * src/proxy.ts porque leva um nonce novo a cada requisição.
 */
const cabecalhosDeSeguranca = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Redundante com frame-ancestors da CSP, para navegadores antigos.
  { key: "X-Frame-Options", value: "DENY" },
  // Links externos não recebem o caminho (nem tokens na URL), só a origem.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // HSTS só atrás de HTTPS; em localhost travaria o navegador em https.
  ...(producao
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Gera um servidor enxuto em .next/standalone, usado pela imagem Docker.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosDeSeguranca }];
  },
};

export default nextConfig;
