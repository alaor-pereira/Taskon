"use client";

import { ChartIncreaseIcon, Table01Icon } from "@hugeicons/core-free-icons";
import { useId, useState, type ReactNode } from "react";
import { Icone } from "@/components/ui/icone";
import { cn } from "@/lib/utils";

/**
 * Peças comuns do Dashboard: o cartão de cada gráfico (com a alternância para
 * tabela), a medida de progresso e o número de destaque. Os gráficos em si
 * ficam em `graficos/`, desenhados com Recharts.
 *
 * Todo gráfico tem um gêmeo em tabela: o passar do mouse enriquece a leitura,
 * mas nunca é o único caminho para o valor.
 */

// --- Invólucro -------------------------------------------------------------

export function ChartCard({
  titulo,
  descricao,
  tabela,
  vazio: vazioInformado,
  acao,
  children,
  className,
}: {
  titulo: string;
  descricao?: string;
  /** Mesmos dados em forma de tabela, para leitura sem depender de cor. */
  tabela: { colunas: string[]; linhas: Array<Array<string | number>> };
  /**
   * Força o estado vazio — para gráficos cujas linhas sempre existem (uma por
   * etapa, por prioridade) mesmo quando todos os valores são zero.
   */
  vazio?: boolean;
  /** Controle extra no cabeçalho, à esquerda do botão de tabela. */
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [verTabela, setVerTabela] = useState(false);
  const idTabela = useId();

  const vazio = vazioInformado ?? tabela.linhas.length === 0;

  return (
    <section
      className={cn(
        "flex flex-col rounded-lg border bg-card p-4",
        className,
      )}
    >
      <header className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="heading-section">{titulo}</h3>
          {descricao && (
            <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>
          )}
        </div>

        {!vazio && acao}

        {!vazio && (
          <button
            type="button"
            onClick={() => setVerTabela((v) => !v)}
            aria-pressed={verTabela}
            aria-controls={idTabela}
            className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors before:absolute before:-inset-2 before:content-[''] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
            title={verTabela ? "Ver gráfico" : "Ver como tabela"}
          >
            {verTabela ? (
              <Icone icon={ChartIncreaseIcon} className="size-4" />
            ) : (
              <Icone icon={Table01Icon} className="size-4" />
            )}
            <span className="sr-only">
              {verTabela ? "Ver gráfico" : "Ver como tabela"}
            </span>
          </button>
        )}
      </header>

      <div id={idTabela} className="min-h-0 flex-1">
        {vazio ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem dados no período.
          </p>
        ) : verTabela ? (
          <TabelaDeDados {...tabela} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function TabelaDeDados({
  colunas,
  linhas,
}: {
  colunas: string[];
  linhas: Array<Array<string | number>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {colunas.map((coluna, i) => (
              <th
                key={coluna}
                scope="col"
                className={cn(
                  "py-1.5 text-xs font-semibold text-muted-foreground",
                  i === 0 ? "text-left" : "text-right",
                )}
              >
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i} className="border-b last:border-0">
              {linha.map((celula, j) => (
                <td
                  key={j}
                  className={cn(
                    "py-1.5",
                    j === 0
                      ? "text-left"
                      : // Colunas de números alinham melhor com dígitos de
                        // largura fixa; valores isolados, não.
                        "text-right tabular-nums",
                  )}
                >
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Medida de progresso ---------------------------------------------------

/**
 * Razão contra um limite.
 *
 * O trilho vazio é um passo claro da mesma rampa — azul sobre azul —, para o
 * estado se ler ao longo da barra inteira, e não só na parte preenchida.
 */
export function Medida({
  rotulo,
  legenda,
  concluidas,
  total,
  percentual,
}: {
  rotulo: string;
  legenda?: string;
  concluidas: number;
  total: number;
  percentual: number;
}) {
  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-sm">{rotulo}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {concluidas}/{total}
        </span>
        <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums">
          {percentual}%
        </span>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--viz-track)" }}
        role="img"
        aria-label={`${rotulo}: ${percentual}% concluído, ${concluidas} de ${total} tarefas`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${percentual}%`,
            backgroundColor: "var(--viz-accent)",
          }}
        />
      </div>

      {legenda && (
        <p className="text-[11px] text-muted-foreground">{legenda}</p>
      )}
    </li>
  );
}

// --- Número de destaque ----------------------------------------------------

/**
 * Bloco de número.
 *
 * Um número isolado usa dígitos de largura proporcional: `tabular-nums` deixa
 * valores como 121 frouxos em tamanho grande, e só ajuda em colunas.
 */
export function BlocoDeNumero({
  rotulo,
  valor,
  detalhe,
  tom = "neutro",
}: {
  rotulo: string;
  valor: number;
  detalhe?: string;
  tom?: "neutro" | "alerta";
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p
        className={cn(
          "mt-1 text-2xl leading-none font-semibold",
          tom === "alerta" && valor > 0 && "text-destructive",
        )}
      >
        {valor}
      </p>
      {detalhe && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{detalhe}</p>
      )}
    </div>
  );
}
