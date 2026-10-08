"use client";

import { Cancel01Icon, Search01Icon, SidebarLeftIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Icone } from "@/components/ui/icone";
import { Input } from "@/components/ui/input";
import { SearchResults } from "@/components/search/search-results";
import { useAbas } from "@/components/tabs/tabs-context";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { t } from "@/lib/messages";
import { AREAS, type AreaId } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { abrirPaginaDaArea } from "./areas/abrir";
import { Logo } from "./logo";
import { SidebarAreas } from "./sidebar-areas";
import { UserFooter } from "./user-footer";

const CHAVE_RECOLHIDA = "taskon:sidebar-recolhida";
const CHAVE_AREA = "taskon:area";

/**
 * Barra lateral fixa.
 *
 * O layout é uma coluna em três faixas: cabeçalho (logo, recolher, busca e os
 * ícones das áreas), seções roláveis, e o rodapé do usuário (menu da conta e
 * notificações). Só a faixa do meio
 * rola — o rodapé é irmão dela, não filho, o que garante que ele fique parado
 * durante a rolagem, como o prompt exige.
 */
export function AppSidebar({
  abertaNoCelular = false,
  aoFecharNoCelular,
}: {
  /** No celular a barra vira gaveta: fora da tela até ser chamada. */
  abertaNoCelular?: boolean;
  aoFecharNoCelular?: () => void;
}) {
  const [recolhida, setRecolhida] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_RECOLHIDA) === "1";
    } catch {
      return false;
    }
  });
  const [area, setArea] = useState<AreaId>(() => {
    try {
      const salva = localStorage.getItem(CHAVE_AREA) as AreaId | null;
      return salva && AREAS.some((a) => a.id === salva) ? salva : "home";
    } catch {
      return "home";
    }
  });
  const [busca, setBusca] = useState("");
  const { abrirAba } = useAbas();

  function alternarRecolhida() {
    setRecolhida((atual) => {
      const proxima = !atual;
      try {
        localStorage.setItem(CHAVE_RECOLHIDA, proxima ? "1" : "0");
      } catch {}
      return proxima;
    });
  }

  /**
   * O ícone faz duas coisas: troca as seções da barra e abre (ou foca) a
   * página da área. Só o ícone manda — alternar abas no Header não mexe na
   * barra. No celular a gaveta fecha, senão cobriria a página recém-aberta.
   */
  function trocarArea(id: AreaId) {
    setArea(id);
    try {
      localStorage.setItem(CHAVE_AREA, id);
    } catch {}
    abrirPaginaDaArea(abrirAba, id);
    aoFecharNoCelular?.();
  }

  return (
    <aside
      className={cn(
        "flex h-dvh shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200",
        recolhida ? "w-14" : "w-65",
        // Até `md` a barra sai da tela e volta como gaveta sobreposta; a
        // largura fixa de 260px não cabe num celular junto com o conteúdo.
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-65",
        abertaNoCelular ? "max-md:translate-x-0" : "max-md:-translate-x-full",
      )}
    >
      {/* Cabeçalho: logo, recolher, busca e ícones das áreas */}
      <div className="shrink-0 px-2 pt-3">
        <div
          className={cn(
            "flex items-center gap-2 px-1",
            recolhida && "flex-col gap-2 px-0",
          )}
        >
          <Logo compacta={recolhida} className={cn(!recolhida && "flex-1")} />
          <Tooltip>
            <TooltipTrigger
              type="button"
              onClick={alternarRecolhida}
              aria-label={recolhida ? t.nav.expandir : t.nav.recolher}
              className="relative inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors before:absolute before:-inset-2 before:content-[''] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
            >
              <Icone icon={SidebarLeftIcon} className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="right">
              {recolhida ? t.nav.expandir : t.nav.recolher}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="mt-3" data-tour="busca">
          {recolhida ? (
            <Tooltip>
              <TooltipTrigger
                type="button"
                aria-label={t.nav.buscar}
                className="inline-flex size-9 w-full items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icone icon={Search01Icon} className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="right">{t.nav.buscar}</TooltipContent>
            </Tooltip>
          ) : (
            <div className="relative">
              <Icone icon={Search01Icon}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t.nav.buscarPlaceholder}
                aria-label={t.nav.buscar}
                className="h-9 w-full pl-8 pr-7 text-sm"
              />

              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  aria-label="Limpar busca"
                  className="absolute top-1/2 right-1.5 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors before:absolute before:-inset-2 before:content-[''] hover:text-foreground"
                >
                  <Icone icon={Cancel01Icon} className="size-4" />
                </button>
              )}

              {/* O painel fica ancorado ao campo por posicionamento absoluto:
                  é mais previsível aqui do que um popover flutuante, já que a
                  barra lateral tem largura fixa. */}
              {busca.trim().length >= 2 && (
                <div className="absolute top-full right-0 left-0 z-50 mt-1 rounded-lg border bg-popover">
                  <SearchResults termo={busca} aoEscolher={() => setBusca("")} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Apenas ícones, sem texto, como define o prompt. */}
        <nav
          aria-label="Navegação principal"
          data-tour="areas"
          className={cn(
            "mt-3 flex items-center gap-0.5",
            recolhida ? "flex-col" : "justify-between",
          )}
        >
          {AREAS.map(({ id, rotulo, icone }) => (
            <Tooltip key={id}>
                <TooltipTrigger
                  type="button"
                  onClick={() => trocarArea(id)}
                  aria-label={rotulo}
                  aria-current={area === id ? "page" : undefined}
                  className={cn(
                    "relative inline-flex size-8 items-center justify-center rounded-full transition-colors before:absolute before:-inset-1.5 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring",
                    area === id
                      ? "text-link"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icone icon={icone} className="size-4.5" />
                </TooltipTrigger>
                <TooltipContent side={recolhida ? "right" : "bottom"}>
                  {rotulo}
                </TooltipContent>
            </Tooltip>
          ))}
        </nav>
      </div>

      <Separator className="mt-3" />

      {/* Única faixa rolável. No celular, escolher um item fecha a gaveta —
          senão ela cobriria justamente o conteúdo recém-aberto. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
        onClick={(evento) => {
          const alvo = evento.target as HTMLElement;
          if (alvo.closest("button")) aoFecharNoCelular?.();
        }}
      >
        {!recolhida && <SidebarAreas area={area} />}
      </div>

      <Separator />

      {/* Fora da área rolável: não se move durante a rolagem */}
      <div className="shrink-0">
        <UserFooter recolhida={recolhida} aoNavegar={aoFecharNoCelular} />
      </div>
    </aside>
  );
}
