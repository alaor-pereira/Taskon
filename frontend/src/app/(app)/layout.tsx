"use client";

import { Menu01Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RetornoDoGoogle } from "@/components/integracoes/retorno-do-google";
import { AceiteDosTermos } from "@/components/legal/aceite-dos-termos";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Logo } from "@/components/layout/logo";
import { Icone } from "@/components/ui/icone";
import { useSession } from "@/lib/auth-client";
import { t } from "@/lib/messages";

/**
 * Casca do sistema: barra lateral fixa à esquerda, header de abas à direita.
 *
 * A verificação de sessão aqui é conveniência de navegação, não segurança:
 * quem garante o acesso é o backend, que valida a sessão em toda requisição.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const { data, isPending, isRefetching } = useSession();
  const router = useRouter();
  const [gavetaAberta, setGavetaAberta] = useState(false);

  // A sessão pode chegar com um "sem usuário" de uma busca feita antes do
  // login; enquanto ela é rebuscada, ainda não dá para concluir que a pessoa
  // não está logada.
  const conferindo = isPending || (isRefetching && !data?.user);

  useEffect(() => {
    if (!conferindo && !data?.user) router.replace("/entrar");
  }, [conferindo, data, router]);

  // Fecha a gaveta com Esc, como se espera de qualquer camada sobreposta.
  useEffect(() => {
    if (!gavetaAberta) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGavetaAberta(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [gavetaAberta]);

  if (conferindo || !data?.user) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Logo />
        <span className="sr-only">Carregando</span>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <AppSidebar
        abertaNoCelular={gavetaAberta}
        aoFecharNoCelular={() => setGavetaAberta(false)}
      />

      {/* Véu do celular: fecha a gaveta ao tocar fora dela. */}
      {gavetaAberta && (
        <button
          type="button"
          aria-label={t.nav.fecharMenu}
          onClick={() => setGavetaAberta(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => setGavetaAberta(true)}
            aria-label={t.nav.abrirMenu}
            aria-expanded={gavetaAberta}
            className="relative ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors before:absolute before:-inset-1 before:content-[''] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring md:hidden"
          >
            <Icone icon={Menu01Icon} className="size-4" />
          </button>

          <div className="min-w-0 flex-1">
            <AppHeader />
          </div>
        </div>

        <main data-tour="conteudo" className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>

      <AceiteDosTermos />
      <RetornoDoGoogle />
    </div>
  );
}
