import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { t } from "@/lib/messages";
import "./globals.css";

/**
 * O design system usa SF Pro, que não é distribuível: em plataformas Apple a
 * pilha de `--font-sans`/`--font-heading` resolve para a fonte do sistema, e
 * no resto cai nesta Inter. Só os pesos do DS (300/400/600) são carregados.
 * `latin-ext` cobre os acentos do português.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: t.app.nome,
    template: `%s · ${t.app.nome}`,
  },
  description:
    "Gerenciamento de projetos, equipes, tarefas e agenda, com controle de acesso por participação.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Gerado por requisição em src/proxy.ts. Ler os cabeçalhos também torna a
  // renderização dinâmica, que é o que permite ao Next aplicar o nonce.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
