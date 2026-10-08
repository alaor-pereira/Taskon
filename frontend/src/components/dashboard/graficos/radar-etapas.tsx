"use client";

import { useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { t } from "@/lib/messages";
import type { DadosDoDashboard } from "@/lib/queries/dashboard";
import type { StatusTarefa } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SERIES } from "./cores";

const ETAPAS: StatusTarefa[] = [
  "BACKLOG",
  "A_FAZER",
  "EM_ANDAMENTO",
  "EM_REVISAO",
  "EM_PAUSA",
  "CONCLUIDO",
];

/**
 * Radar de etapas × projetos: um eixo por etapa e um polígono por projeto,
 * com a quantidade de tarefas do projeto em cada etapa. O formato mostra onde
 * o trabalho de cada projeto está concentrado.
 *
 * A legenda ao lado é também o controle: clicar num projeto esconde ou mostra
 * o polígono dele, para comparar dois de cada vez.
 */
export function RadarEtapas({ projetos }: { projetos: DadosDoDashboard["etapasPorProjeto"] }) {
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());

  // Cada projeto ganha a série da sua posição na lista (já ordenada pelo
  // servidor) — a cor não muda ao esconder outro projeto.
  const series = projetos.map((projeto, i) => ({
    chave: `p${i}`,
    projeto,
    cor: SERIES[i]!,
  }));

  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.chave, { label: s.projeto.nome, color: s.cor }]),
  );

  const dados = ETAPAS.map((etapa) => ({
    etapa: t.status[etapa],
    ...Object.fromEntries(series.map((s) => [s.chave, s.projeto.porStatus[etapa] ?? 0])),
  }));

  function alternar(chave: string) {
    setOcultos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ChartContainer config={config} className="aspect-square w-full max-w-[340px] flex-1">
        <RadarChart data={dados} outerRadius="72%">
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="etapa"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <PolarRadiusAxis angle={90} tick={false} axisLine={false} allowDecimals={false} />
          {series
            .filter((s) => !ocultos.has(s.chave))
            .map((s) => (
              <Radar
                key={s.chave}
                dataKey={s.chave}
                stroke={`var(--color-${s.chave})`}
                fill={`var(--color-${s.chave})`}
                fillOpacity={0.15}
                strokeWidth={2}
                dot={{ r: 4, fillOpacity: 1, stroke: "var(--card)", strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
        </RadarChart>
      </ChartContainer>

      <ul className="w-full space-y-1 sm:w-56" aria-label="Projetos no gráfico">
        {series.map((s) => {
          const visivel = !ocultos.has(s.chave);
          return (
            <li key={s.chave}>
              <button
                type="button"
                onClick={() => alternar(s.chave)}
                aria-pressed={visivel}
                title={visivel ? "Esconder do gráfico" : "Mostrar no gráfico"}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                  !visivel && "opacity-45",
                )}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.cor }}
                />
                <span className="min-w-0 flex-1 truncate">{s.projeto.nome}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {s.projeto.total} {s.projeto.total === 1 ? "tarefa" : "tarefas"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
