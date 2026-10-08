import type { ReactNode } from "react";

/**
 * Grade dos cartões de projeto e tarefa: até 4 por linha.
 *
 * As colunas seguem a largura da própria grade, não a da tela: a mesma lista
 * aparece em página cheia e ao lado do painel de comentários da tarefa, e só
 * o espaço disponível diz quantos cartões cabem sem apertar.
 */
export function GradeDeCards({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <div className="grid gap-2 @xl:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

/** Ocupa o lugar da grade enquanto os dados chegam. */
export function GradeDeCardsEsqueleto({
  quantidade = 8,
  altura = "h-24",
}: {
  quantidade?: number;
  altura?: string;
}) {
  return (
    <GradeDeCards>
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className={`${altura} animate-pulse rounded-lg bg-muted`} />
      ))}
    </GradeDeCards>
  );
}

/** Mais recente primeiro: criar também conta como alteração. */
export function porAlteracaoRecente<T extends { updatedAt: string }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
