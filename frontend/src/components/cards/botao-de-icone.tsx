"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Ação de ícone solto nos cartões e nas linhas da Lista: sem fundo, só cor.
 * `destrutivo` avermelha no hover, para a lixeira.
 */
export function BotaoDeIcone({
  rotulo,
  onClick,
  destrutivo = false,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  destrutivo?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      // No Kanban o cartão é arrastável: o ponteiro que começa num botão não
      // deve iniciar um arrasto.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring",
        destrutivo ? "hover:text-destructive" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
