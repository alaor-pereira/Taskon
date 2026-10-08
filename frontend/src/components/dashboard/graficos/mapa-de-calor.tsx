"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLayoutEffect, useRef, useState } from "react";
import { dataPuraLocal } from "@/lib/datas";
import type { DadosDoDashboard } from "@/lib/queries/dashboard";
import { RAMPA_DE_INTENSIDADE } from "./cores";

/** Mesmo num período curto, a grade mostra ao menos 12 semanas de contexto. */
const DIAS_MINIMOS = 12 * 7;
const ROTULOS_DOS_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** AAAA-MM-DD no fuso do navegador. */
function chaveDoDia(data: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

interface Celula {
  chave: string;
  data: Date;
  total: number;
  /** Fora da grade (antes do primeiro dia ou depois do último): só ocupa lugar. */
  fora: boolean;
  /** Na grade, mas antes do período: aparece apagada, sem contagem. */
  foraDoPeriodo: boolean;
}

/**
 * Conclusões por dia no período, em grade (colunas = semanas, linhas = dias da
 * semana). Um gráfico de magnitude: uma rampa de um matiz só, mais intensa
 * onde houve mais entregas. O servidor manda só os dias com conclusão; os
 * demais são completados aqui com zero.
 *
 * A grade termina no fim do período e cobre ao menos 12 semanas: num período
 * curto, os dias antes dele aparecem apagados, e o cartão não encolhe para
 * uma ou duas colunas.
 */
export function MapaDeCalor({ mapa }: { mapa: DadosDoDashboard["mapaDeEntregas"] }) {
  const [emFoco, setEmFoco] = useState<Celula | null>(null);
  const rolagem = useRef<HTMLDivElement>(null);

  const porDia = new Map(mapa.dias.map((d) => [d.dia, d.total]));
  const inicioDoPeriodo = dataPuraLocal(mapa.inicio);
  const fim = dataPuraLocal(mapa.fim);
  const inicioMinimo = new Date(fim);
  inicioMinimo.setDate(inicioMinimo.getDate() - (DIAS_MINIMOS - 1));
  const inicio = inicioDoPeriodo < inicioMinimo ? inicioDoPeriodo : inicioMinimo;
  // A grade começa no domingo da semana do primeiro dia.
  const primeiroDomingo = new Date(inicio);
  primeiroDomingo.setDate(primeiroDomingo.getDate() - primeiroDomingo.getDay());

  const semanas: Celula[][] = [];
  for (let cursor = new Date(primeiroDomingo); cursor <= fim; ) {
    const semana: Celula[] = [];
    for (let d = 0; d < 7; d++) {
      const data = new Date(cursor);
      const chave = chaveDoDia(data);
      semana.push({
        chave,
        data,
        total: porDia.get(chave) ?? 0,
        fora: data < inicio || data > fim,
        foraDoPeriodo: data < inicioDoPeriodo,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    semanas.push(semana);
  }

  // Com mais semanas do que cabem, a grade abre rolada no fim: o mais recente
  // é o que interessa primeiro.
  useLayoutEffect(() => {
    const el = rolagem.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [mapa.inicio, mapa.fim]);

  const maximo = Math.max(1, ...mapa.dias.map((d) => d.total));
  /** 0 = sem entregas (trilho); 1..5 = passos da rampa. */
  const nivel = (total: number) =>
    total === 0 ? 0 : Math.min(5, Math.ceil((total / maximo) * 5));
  const corDoNivel = (n: number) => (n === 0 ? "var(--viz-track)" : RAMPA_DE_INTENSIDADE[n - 1]);

  const totalNoPeriodo = mapa.dias.reduce((soma, d) => soma + d.total, 0);

  return (
    <div className="space-y-3">
      <p className="h-4 text-xs text-muted-foreground" aria-live="polite">
        {emFoco
          ? `${emFoco.total} ${emFoco.total === 1 ? "concluída" : "concluídas"} em ${format(emFoco.data, "EEEE, d 'de' MMM", { locale: ptBR })}`
          : `${totalNoPeriodo} ${totalNoPeriodo === 1 ? "tarefa concluída" : "tarefas concluídas"} no período`}
      </p>

      <div ref={rolagem} className="flex gap-1.5 overflow-x-auto pb-1">
        <div className="grid shrink-0 grid-rows-7 gap-1 pt-4 pr-1 text-[10px] text-muted-foreground">
          {ROTULOS_DOS_DIAS.map((rotulo, i) => (
            <span key={rotulo} className="flex h-3.5 items-center leading-none">
              {i % 2 === 1 ? rotulo : ""}
            </span>
          ))}
        </div>

        {semanas.map((semana, s) => {
          const primeiro = semana[0]!.data;
          const mudaOMes = s === 0 || primeiro.getDate() <= 7;
          return (
            <div key={semana[0]!.chave} className="flex shrink-0 flex-col gap-1">
              <span className="h-3 text-[10px] leading-none text-muted-foreground">
                {mudaOMes ? format(primeiro, "MMM", { locale: ptBR }) : ""}
              </span>
              {semana.map((celula) =>
                celula.fora ? (
                  <span key={celula.chave} className="size-3.5" aria-hidden />
                ) : celula.foraDoPeriodo ? (
                  <span
                    key={celula.chave}
                    aria-hidden
                    className="size-3.5 rounded-[3px] opacity-35"
                    style={{ backgroundColor: corDoNivel(0) }}
                  />
                ) : (
                  <span
                    key={celula.chave}
                    role="img"
                    tabIndex={0}
                    aria-label={`${format(celula.data, "d 'de' MMMM", { locale: ptBR })}: ${celula.total} concluídas`}
                    onMouseEnter={() => setEmFoco(celula)}
                    onMouseLeave={() => setEmFoco(null)}
                    onFocus={() => setEmFoco(celula)}
                    onBlur={() => setEmFoco(null)}
                    className="size-3.5 rounded-[3px] outline-offset-1 transition-transform hover:scale-125 focus-visible:outline-2 focus-visible:outline-ring"
                    style={{ backgroundColor: corDoNivel(nivel(celula.total)) }}
                  />
                ),
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        Menos
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            aria-hidden
            className="size-3 rounded-[3px]"
            style={{ backgroundColor: corDoNivel(n) }}
          />
        ))}
        Mais
      </div>
    </div>
  );
}
