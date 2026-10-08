"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { dataCurta, dataPuraLocal } from "@/lib/datas";
import type { DadosDoDashboard, GranularidadeDoFluxo } from "@/lib/queries/dashboard";
import { SERIES } from "./cores";

const config = {
  criadas: { label: "Criadas", color: SERIES[0] },
  concluidas: { label: "Concluídas", color: SERIES[1] },
} satisfies ChartConfig;

/** Rótulo curto (eixo) e completo (dica) de cada balde. */
export function rotulosDoBalde(
  inicio: string,
  granularidade: GranularidadeDoFluxo,
): { curto: string; completo: string } {
  const data = dataPuraLocal(inicio);
  switch (granularidade) {
    case "dia":
      return {
        curto: dataCurta(inicio).slice(0, 5),
        completo: format(data, "EEEE, d 'de' MMMM", { locale: ptBR }),
      };
    case "semana":
      return { curto: dataCurta(inicio).slice(0, 5), completo: `Semana de ${dataCurta(inicio)}` };
    case "mes":
      return {
        curto: format(data, "MMM/yy", { locale: ptBR }),
        completo: format(data, "MMMM 'de' yyyy", { locale: ptBR }),
      };
  }
}

/**
 * Criadas × concluídas por dia, semana ou mês: barras lado a lado no mesmo
 * eixo. Quando as concluídas acompanham as criadas, o time dá conta do que
 * entra; quando ficam para trás, a fila cresce. O tamanho do balde vem do
 * servidor, conforme a duração do período.
 */
export function Fluxo({ fluxo }: { fluxo: DadosDoDashboard["fluxo"] }) {
  const dados = fluxo.baldes.map((b) => {
    const rotulos = rotulosDoBalde(b.inicio, fluxo.granularidade);
    return { ...b, rotulo: rotulos.curto, rotuloCompleto: rotulos.completo };
  });

  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <BarChart data={dados} barGap={2} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, itens) => itens[0]?.payload?.rotuloCompleto ?? ""}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="criadas" fill="var(--color-criadas)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar
          dataKey="concluidas"
          fill="var(--color-concluidas)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ChartContainer>
  );
}
