"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Escolha única entre poucas opções, numa cápsula com borda: o filtro de
 * Equipes, de membros e de projetos da equipe, e as visões da Agenda. Só a
 * opção ativa ganha fundo.
 */
export function SeletorSegmentado<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
  className,
}: {
  opcoes: Array<{ valor: T; rotulo: ReactNode }>;
  valor: T | undefined;
  aoMudar: (valor: T) => void;
  /** Nome do grupo para leitores de tela, ex.: "Filtrar equipes". */
  rotulo: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className={cn("flex items-center gap-0.5 rounded-full border p-0.5", className)}
    >
      {opcoes.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          aria-pressed={valor === opcao.valor}
          onClick={() => aoMudar(opcao.valor)}
          className={cn(
            "h-7 rounded-full px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring",
            valor === opcao.valor
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  );
}
