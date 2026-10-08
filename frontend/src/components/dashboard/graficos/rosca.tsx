"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export interface Fatia {
  chave: string;
  rotulo: string;
  valor: number;
  cor: string;
}

/**
 * Rosca de composição: as partes de um todo, com o total no centro e a
 * legenda ao lado (cor, rótulo, quantidade e %), para o valor nunca depender
 * só da cor. Fatias vizinhas são separadas por um vão na cor do cartão.
 */
export function Rosca({ fatias, unidade }: { fatias: Fatia[]; unidade: string }) {
  const total = fatias.reduce((soma, f) => soma + f.valor, 0);
  const config: ChartConfig = Object.fromEntries(
    fatias.map((f) => [f.chave, { label: f.rotulo, color: f.cor }]),
  );
  // Fatia zerada não desenha nada, mas continua na legenda.
  const visiveis = fatias.filter((f) => f.valor > 0);

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div className="relative size-32 shrink-0">
        <ChartContainer config={config} className="aspect-square size-32">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent nameKey="chave" hideLabel />}
            />
            <Pie
              data={visiveis}
              dataKey="valor"
              nameKey="chave"
              innerRadius="64%"
              outerRadius="100%"
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {visiveis.map((f) => (
                <Cell key={f.chave} fill={f.cor} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl leading-none font-semibold tabular-nums">{total}</span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">{unidade}</span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {fatias.map((f) => (
          <li key={f.chave} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: f.cor }}
            />
            <span className="min-w-0 flex-1 truncate">{f.rotulo}</span>
            <span className="tabular-nums">{f.valor}</span>
            <span className="w-8 text-right text-muted-foreground tabular-nums">
              {total === 0 ? "0%" : `${Math.round((f.valor / total) * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
