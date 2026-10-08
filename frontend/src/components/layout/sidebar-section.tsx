"use client";

import { ArrowDown01Icon, ArrowRightDoubleIcon } from "@hugeicons/core-free-icons";
import { useState, type ReactNode } from "react";
import { Icone } from "@/components/ui/icone";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Seção da barra lateral: título, atalho "ver todos" e conteúdo recolhível.
 * Criar fica nos botões das próprias páginas, não aqui. Toda seção do prompt (Recentes, Vencem Hoje, Meus
 * Projetos, Prioridade Alta, etc.) usa este mesmo invólucro, para que o
 * espaçamento e o comportamento sejam idênticos em todas as áreas.
 */
export function SidebarSection({
  titulo,
  aoVerTodos,
  rotuloVerTodos,
  children,
}: {
  titulo: string;
  aoVerTodos?: () => void;
  rotuloVerTodos?: string;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState(true);

  return (
    <section className="px-1 py-1">
      <div className="group/sec flex items-center gap-1 rounded-md px-2 py-1">
        <button
          type="button"
          onClick={() => setAberta((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
          aria-expanded={aberta}
        >
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {titulo}
          </span>
          {/* Só o ícone: o título inteiro já é o botão de recolher, e um
              botão dentro de outro quebra a hidratação. */}
          <Icone
            icon={ArrowDown01Icon}
            aria-hidden
            className={cn(
              "size-3 shrink-0 text-muted-foreground/70 transition-transform",
              !aberta && "-rotate-90",
            )}
          />
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          {aoVerTodos && (
            <AcaoIcone
              rotulo={rotuloVerTodos ?? "Ver todos"}
              onClick={aoVerTodos}
              icone={<Icone icon={ArrowRightDoubleIcon} className="size-3.5" />}
            />
          )}
        </div>
      </div>

      {aberta && <div className="mt-0.5 space-y-px">{children}</div>}
    </section>
  );
}

function AcaoIcone({
  rotulo,
  onClick,
  icone,
}: {
  rotulo: string;
  onClick: () => void;
  icone: ReactNode;
}) {
  // TooltipTrigger do Base UI já renderiza um <button>: não precisa de invólucro.
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        onClick={onClick}
        aria-label={rotulo}
        className="relative inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors before:absolute before:-inset-3 before:content-[''] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
      >
        {icone}
      </TooltipTrigger>
      <TooltipContent side="right">{rotulo}</TooltipContent>
    </Tooltip>
  );
}

/** Linha de item dentro de uma seção. */
export function SidebarItem({
  icone,
  titulo,
  indicador,
  detalhe,
  legenda,
  ativo,
  onClick,
  acoes,
}: {
  icone?: ReactNode;
  titulo: string;
  /** Marca pequena e sempre visível ao lado do título (ex.: "se repete"). */
  indicador?: ReactNode;
  /** Valor curto alinhado à direita: contagem, data, tempo decorrido, marcas. */
  detalhe?: ReactNode;
  /** Segunda linha, para contexto como "alterado por". */
  legenda?: string;
  ativo?: boolean;
  onClick?: () => void;
  /** Menu de três pontinhos, revelado no hover no lugar do `detalhe`. */
  acoes?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group/item relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        // O fundo usa o accent da sidebar: o `accent` geral tem a mesma cor do
        // fundo dela no tema claro e deixaria o destaque invisível.
        ativo
          ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-link before:content-['']"
          : // Com o menu ⋮ aberto, a linha segue destacada: mostra de quem é o menu.
            "hover:bg-sidebar-accent/60 has-aria-expanded:bg-sidebar-accent/60",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-current={ativo ? "page" : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        {icone && <span className="shrink-0 text-foreground">{icone}</span>}
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "flex items-center gap-1 font-normal",
              !ativo && "text-foreground",
            )}
          >
            <span className="truncate">{titulo}</span>
            {indicador}
          </span>
          {legenda && (
            <span className="block text-xs font-normal text-muted-foreground/40">
              {legenda}
            </span>
          )}
        </span>
      </button>

      {/* O contador e o menu de ações ocupam o mesmo espaço: o menu surge no
          lugar do contador, em vez de empurrar o layout. Ele aparece com o
          mouse no item, com o menu aberto (`aria-expanded`) ou com foco de
          teclado — e o detalhe some nesses mesmos casos, nunca os dois. */}
      {(detalhe || acoes) && (
        <span className="group/celula grid shrink-0 items-center place-items-end">
          {detalhe && (
            <span
              className={cn(
                "col-start-1 row-start-1 text-[10px] font-semibold text-muted-foreground/40",
                acoes &&
                  "group-hover/item:opacity-0 group-has-aria-expanded/celula:opacity-0 group-has-focus-visible/celula:opacity-0",
              )}
            >
              {detalhe}
            </span>
          )}
          {acoes && (
            <span className="col-start-1 row-start-1 opacity-0 transition-opacity group-hover/item:opacity-100 has-focus-visible:opacity-100 has-aria-expanded:opacity-100">
              {acoes}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/** Ocupa o espaço da lista enquanto os dados chegam, sem deslocar o layout. */
export function SidebarEsqueleto({ linhas = 2 }: { linhas?: number }) {
  return (
    <div className="space-y-1 px-2 py-1">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="h-5 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

/** Mensagem exibida quando a seção não tem itens. */
export function SidebarVazio({ mensagem }: { mensagem: string }) {
  return (
    <p className="px-2 py-1 text-xs leading-relaxed text-muted-foreground/40">
      {mensagem}
    </p>
  );
}
