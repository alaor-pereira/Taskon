"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { t } from "@/lib/messages";
import type { DadosDoDashboard } from "@/lib/queries/dashboard";
import { COR_DA_PRIORIDADE } from "./cores";

const config = {
  ALTA: { label: t.prioridade.ALTA, color: COR_DA_PRIORIDADE.ALTA },
  MEDIA: { label: t.prioridade.MEDIA, color: COR_DA_PRIORIDADE.MEDIA },
  BAIXA: { label: t.prioridade.BAIXA, color: COR_DA_PRIORIDADE.BAIXA },
} satisfies ChartConfig;

const PRIORIDADES = ["ALTA", "MEDIA", "BAIXA"] as const;

/**
 * Tarefas abertas de cada pessoa, empilhadas por prioridade: mostra quem está
 * com mais trabalho — e de que peso. Considera o time todo, mesmo com o
 * escopo "Só as minhas", que aqui mostraria só a própria pessoa.
 */
export function CargaPorResponsavel({
  carga,
}: {
  carga: DadosDoDashboard["cargaPorResponsavel"];
}) {
  const altura = Math.max(160, carga.pessoas.length * 36 + 56);

  return (
    <div>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: altura }}>
        <BarChart
          data={carga.pessoas}
          layout="vertical"
          margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          barCategoryGap={8}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="nome"
            width={112}
            tickLine={false}
            axisLine={false}
            tickFormatter={(nome: string) => (nome.length > 16 ? `${nome.slice(0, 15)}…` : nome)}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={<ChartTooltipContent />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          {PRIORIDADES.map((prioridade, i) => (
            <Bar
              key={prioridade}
              dataKey={prioridade}
              stackId="carga"
              fill={`var(--color-${prioridade})`}
              // Vão de 2px entre os segmentos, na cor do cartão.
              stroke="var(--card)"
              strokeWidth={2}
              radius={i === PRIORIDADES.length - 1 ? [0, 4, 4, 0] : 0}
              maxBarSize={22}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Considera todas as tarefas abertas dos projetos visíveis, independentemente do filtro
        &ldquo;Tarefas&rdquo;.
        {carga.semResponsavel > 0 &&
          ` ${carga.semResponsavel} ${carga.semResponsavel === 1 ? "tarefa está" : "tarefas estão"} sem responsável.`}
      </p>
    </div>
  );
}
