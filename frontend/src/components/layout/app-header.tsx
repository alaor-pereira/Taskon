"use client";

import { ArrowDown01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAbas, type Aba } from "@/components/tabs/tabs-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/messages";
import { cn } from "@/lib/utils";

/** Largura do esmaecido nas bordas quando há abas escondidas. */
const ESMAECIDO = 24;

/**
 * Header à direita da barra lateral: só as abas abertas.
 *
 * Com muitas abas, elas primeiro encolhem (título truncado) até uma largura
 * mínima; passando disso, a faixa rola na horizontal sem barra de rolagem —
 * uma barra ali aumentava a altura do header e empurrava a página. As bordas
 * esmaecem para indicar que há mais abas, e a seta no fim lista todas.
 */
export function AppHeader() {
  const { abas, abaAtivaId, ativarAba, fecharAba } = useAbas();
  const faixa = useRef<HTMLDivElement>(null);
  const [bordas, setBordas] = useState({ inicio: false, fim: false });

  const medir = useCallback(() => {
    const el = faixa.current;
    if (!el) return;
    const inicio = el.scrollLeft > 1;
    const fim = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setBordas((atual) =>
      atual.inicio === inicio && atual.fim === fim ? atual : { inicio, fim },
    );
  }, []);

  // Largura da janela e quantidade de abas mudam o transbordo.
  useLayoutEffect(() => {
    const el = faixa.current;
    if (!el) return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    for (const filho of el.children) observador.observe(filho);
    return () => observador.disconnect();
  }, [abas, medir]);

  // A aba ativa sempre à vista, inclusive quando aberta pela barra lateral.
  useEffect(() => {
    if (!abaAtivaId) return;
    const el = faixa.current?.querySelector<HTMLElement>(
      `[data-aba-id="${CSS.escape(abaAtivaId)}"]`,
    );
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [abaAtivaId, abas.length]);

  const indiceAtiva = abas.findIndex((a) => a.id === abaAtivaId);
  const transborda = bordas.inicio || bordas.fim;

  return (
    <header data-tour="abas" className="flex h-[34px] shrink-0 items-stretch surface-frost pl-1.5">
      <div
        ref={faixa}
        role="tablist"
        aria-label="Páginas abertas"
        onScroll={medir}
        // A roda do mouse é vertical; aqui ela passa as abas para os lados.
        onWheel={(e) => {
          if (e.deltaY !== 0 && faixa.current) faixa.current.scrollLeft += e.deltaY;
        }}
        className="flex min-w-0 flex-1 items-end overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
        style={mascara(bordas)}
      >
        {abas.map((aba, i) => (
          <AbaBotao
            key={aba.id}
            aba={aba}
            ativa={aba.id === abaAtivaId}
            // O separador some colado na ativa, dos dois lados.
            antesDaAtiva={i === indiceAtiva - 1}
            onAtivar={() => ativarAba(aba.id)}
            onFechar={() => fecharAba(aba.id)}
          />
        ))}
      </div>

      {transborda && (
        <ListaDeAbas abas={abas} abaAtivaId={abaAtivaId} onAtivar={ativarAba} />
      )}
    </header>
  );
}

/** Esmaece só as bordas em que há abas escondidas. */
function mascara({ inicio, fim }: { inicio: boolean; fim: boolean }) {
  if (!inicio && !fim) return undefined;
  const gradiente = `linear-gradient(to right, ${
    inicio ? `transparent, #000 ${ESMAECIDO}px` : "#000"
  }, ${fim ? `#000 calc(100% - ${ESMAECIDO}px), transparent` : "#000"})`;
  return { maskImage: gradiente, WebkitMaskImage: gradiente };
}

/**
 * Aba no estilo de navegador: a ativa "sobe" com o fundo da página, texto
 * pleno e um traço na cor primária no topo; as demais ficam discretas, em
 * cinza, separadas por um fio vertical. O "x" da ativa fica sempre visível;
 * nas demais aparece ao passar o mouse, para não pesar a faixa.
 */
function AbaBotao({
  aba,
  ativa,
  antesDaAtiva,
  onAtivar,
  onFechar,
}: {
  aba: Aba;
  ativa: boolean;
  antesDaAtiva: boolean;
  onAtivar: () => void;
  onFechar: () => void;
}) {
  return (
    <div
      data-aba-id={aba.id}
      className={cn(
        "group/aba relative flex h-[30px] min-w-[5.5rem] shrink basis-44 items-center gap-0.5 rounded-t-md pr-1 pl-2.5 text-[13px] transition-colors",
        // Separador à direita; some na última, na ativa, na vizinha da
        // ativa, na aba sob o mouse e na vizinha da aba sob o mouse.
        "after:absolute after:top-1/2 after:right-0 after:h-3.5 after:w-px after:-translate-y-1/2 after:bg-border after:content-[''] last:after:hidden hover:after:hidden [&:has(+:hover)]:after:hidden",
        (ativa || antesDaAtiva) && "after:hidden",
        ativa
          ? "z-10 bg-background font-medium text-foreground before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:rounded-t-md before:bg-link before:content-['']"
          : "text-muted-foreground hover:bg-background/50 hover:text-foreground/80",
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={ativa}
        onClick={onAtivar}
        title={aba.titulo}
        className="min-w-0 flex-1 truncate text-left outline-none focus-visible:underline"
      >
        {aba.titulo}
      </button>
      <button
        type="button"
        onClick={onFechar}
        aria-label={`${t.acoes.fecharAba}: ${aba.titulo}`}
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[color,opacity] hover:text-foreground focus-visible:text-foreground focus-visible:opacity-100",
          !ativa && "opacity-0 group-hover/aba:opacity-100",
        )}
      >
        <Icone icon={Cancel01Icon} className="size-3" />
      </button>
    </div>
  );
}

/** Seta no fim da faixa, só quando há abas escondidas: lista todas. */
function ListaDeAbas({
  abas,
  abaAtivaId,
  onAtivar,
}: {
  abas: Aba[];
  abaAtivaId: string | null;
  onAtivar: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label="Todas as abas abertas"
        className="mx-1 inline-flex size-6 shrink-0 items-center justify-center self-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
      >
        <Icone icon={ArrowDown01Icon} className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {abas.map((aba) => (
          <DropdownMenuItem
            key={aba.id}
            onClick={() => onAtivar(aba.id)}
            className={cn(
              "truncate",
              aba.id === abaAtivaId ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {aba.titulo}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
