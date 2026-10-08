"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { DadosDoDashboard } from "@/lib/queries/dashboard";
import { SERIES } from "./cores";

const config = {
  percentual: { label: "Dentro do prazo", color: SERIES[0] },
} satisfies ChartConfig;

/**
 * Das tarefas concluídas no período que tinham prazo, quantas saíram até o
 * dia do vencimento. Um valor só contra 100%: um medidor, não um gráfico de
 * categorias — o número no centro é a leitura principal.
 */
export function MedidorNoPrazo({ noPrazo }: { noPrazo: DadosDoDashboard["noPrazo"] }) {
  const { concluidas, comPrazo, dentroDoPrazo } = noPrazo;
  const percentual = comPrazo === 0 ? 0 : Math.round((dentroDoPrazo / comPrazo) * 100);

  if (comPrazo === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma tarefa com prazo foi concluída no período.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative size-44">
        <ChartContainer config={config} className="aspect-square size-44">
          <RadialBarChart
            data={[{ percentual }]}
            startAngle={90}
            endAngle={-270}
            innerRadius="78%"
            outerRadius="100%"
            barSize={14}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
            <RadialBar
              dataKey="percentual"
              fill="var(--color-percentual)"
              background={{ fill: "var(--viz-track)" }}
              cornerRadius={7}
              isAnimationActive={false}
            />
          </RadialBarChart>
        </ChartContainer>
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          role="img"
          aria-label={`${percentual}% das tarefas com prazo foram concluídas no prazo`}
        >
          <span className="text-3xl leading-none font-semibold tabular-nums">{percentual}%</span>
          <span className="mt-1 text-xs text-muted-foreground">no prazo</span>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {dentroDoPrazo} de {comPrazo} com prazo · {concluidas}{" "}
        {concluidas === 1 ? "concluída" : "concluídas"} no período
      </p>
    </div>
  );
}
