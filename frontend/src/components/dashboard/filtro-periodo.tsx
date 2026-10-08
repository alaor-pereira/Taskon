"use client";

import { ArrowDown01Icon, Calendar03Icon } from "@hugeicons/core-free-icons";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useSyncExternalStore } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Icone } from "@/components/ui/icone";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dataCurta, dataPuraLocal } from "@/lib/datas";
import { cn } from "@/lib/utils";

/**
 * Período do Dashboard: um atalho ("Últimos 30 dias", "Mês passado"…) ou um
 * intervalo escolhido no calendário. O atalho fica guardado como atalho, e
 * não como as datas que ele dá hoje: "Este mês" continua sendo este mês se a
 * tela ficar aberta de um dia para o outro.
 */
export type Periodo = { atalho: IdDoAtalho } | { de: string; ate: string };

type IdDoAtalho =
  | "hoje"
  | "estaSemana"
  | "semanaPassada"
  | "esteMes"
  | "mesPassado"
  | "esteAno"
  | "ultimos7"
  | "ultimos30"
  | "ultimos90"
  | "ultimos12Meses"
  | "tudo";

interface Atalho {
  id: IdDoAtalho;
  rotulo: string;
  /** O intervalo que o atalho dá a partir de hoje; `null` é todo o período. */
  intervalo: (hoje: Date) => { de: Date; ate: Date } | null;
}

// A semana começa na segunda, como no agrupamento do servidor.
const SEMANA = { weekStartsOn: 1 } as const;

/** Atalhos em grupos: dias e semanas, meses e ano, janelas móveis, tudo. */
const GRUPOS_DE_ATALHOS: Atalho[][] = [
  [
    { id: "hoje", rotulo: "Hoje", intervalo: (hoje) => ({ de: hoje, ate: hoje }) },
    {
      id: "estaSemana",
      rotulo: "Esta semana",
      intervalo: (hoje) => ({ de: startOfWeek(hoje, SEMANA), ate: hoje }),
    },
    {
      id: "semanaPassada",
      rotulo: "Semana passada",
      intervalo: (hoje) => {
        const passada = subWeeks(hoje, 1);
        return { de: startOfWeek(passada, SEMANA), ate: endOfWeek(passada, SEMANA) };
      },
    },
  ],
  [
    {
      id: "esteMes",
      rotulo: "Este mês",
      intervalo: (hoje) => ({ de: startOfMonth(hoje), ate: hoje }),
    },
    {
      id: "mesPassado",
      rotulo: "Mês passado",
      intervalo: (hoje) => {
        const passado = subMonths(hoje, 1);
        return { de: startOfMonth(passado), ate: endOfMonth(passado) };
      },
    },
    {
      id: "esteAno",
      rotulo: "Este ano",
      intervalo: (hoje) => ({ de: startOfYear(hoje), ate: hoje }),
    },
  ],
  [
    { id: "ultimos7", rotulo: "Últimos 7 dias", intervalo: (hoje) => ultimosDias(hoje, 7) },
    { id: "ultimos30", rotulo: "Últimos 30 dias", intervalo: (hoje) => ultimosDias(hoje, 30) },
    { id: "ultimos90", rotulo: "Últimos 90 dias", intervalo: (hoje) => ultimosDias(hoje, 90) },
    {
      id: "ultimos12Meses",
      rotulo: "Últimos 12 meses",
      intervalo: (hoje) => ({ de: addDays(subYears(hoje, 1), 1), ate: hoje }),
    },
  ],
  [{ id: "tudo", rotulo: "Todo o período", intervalo: () => null }],
];

const ATALHOS = GRUPOS_DE_ATALHOS.flat();

export const PERIODO_PADRAO: Periodo = { atalho: "ultimos30" };

/** "Últimos N dias" conta hoje: os 7 dias são hoje e os seis anteriores. */
function ultimosDias(hoje: Date, dias: number) {
  return { de: subDays(hoje, dias - 1), ate: hoje };
}

function hojeLocal(): Date {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}

const paraIso = (data: Date) => format(data, "yyyy-MM-dd");

/** As datas que o período cobre hoje; `null` é todo o período. */
export function intervaloDoPeriodo(periodo: Periodo): { de: string; ate: string } | null {
  if (!("atalho" in periodo)) return periodo;
  const intervalo = ATALHOS.find((a) => a.id === periodo.atalho)?.intervalo(hojeLocal());
  return intervalo ? { de: paraIso(intervalo.de), ate: paraIso(intervalo.ate) } : null;
}

/** "Últimos 30 dias", "Todo o período" ou "01/09/2026 – 30/09/2026". */
export function rotuloDoPeriodo(periodo: Periodo): string {
  if ("atalho" in periodo) {
    return ATALHOS.find((a) => a.id === periodo.atalho)?.rotulo ?? "";
  }
  return periodo.de === periodo.ate
    ? dataCurta(periodo.de)
    : `${dataCurta(periodo.de)} – ${dataCurta(periodo.ate)}`;
}

function mesmoPeriodo(a: Periodo, b: Periodo): boolean {
  if ("atalho" in a || "atalho" in b) {
    return "atalho" in a && "atalho" in b && a.atalho === b.atalho;
  }
  return a.de === b.de && a.ate === b.ate;
}

/** Dois meses lado a lado só quando cabem. */
function useTelaLarga(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia("(min-width: 640px)");
      consulta.addEventListener("change", avisar);
      return () => consulta.removeEventListener("change", avisar);
    },
    () => window.matchMedia("(min-width: 640px)").matches,
    () => true,
  );
}

/**
 * Filtro de período em pílula, no mesmo visual do `FiltroSelect`. Abre um
 * painel com atalhos e um calendário: o atalho aplica na hora; o intervalo do
 * calendário só vale no "Aplicar", para o painel não recarregar no primeiro
 * clique, com metade do intervalo escolhida.
 */
export function FiltroPeriodo({
  valor,
  aoMudar,
}: {
  valor: Periodo;
  aoMudar: (periodo: Periodo) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<DateRange | undefined>();
  const telaLarga = useTelaLarga();
  const ativo = !mesmoPeriodo(valor, PERIODO_PADRAO);
  const hoje = hojeLocal();

  function abrirOuFechar(abrir: boolean) {
    if (abrir) {
      // O calendário abre mostrando o período atual (exceto "todo o período").
      const atual = intervaloDoPeriodo(valor);
      setRascunho(
        atual ? { from: dataPuraLocal(atual.de), to: dataPuraLocal(atual.ate) } : undefined,
      );
    }
    setAberto(abrir);
  }

  function escolherAtalho(id: IdDoAtalho) {
    aoMudar({ atalho: id });
    setAberto(false);
  }

  function aplicar() {
    if (!rascunho?.from) return;
    // Um clique só no calendário vale como um dia.
    const ate = rascunho.to ?? rascunho.from;
    aoMudar({ de: paraIso(rascunho.from), ate: paraIso(ate) });
    setAberto(false);
  }

  const fimVisivel = rascunho?.to ?? rascunho?.from ?? hoje;

  return (
    <Popover open={aberto} onOpenChange={abrirOuFechar}>
      <PopoverTrigger
        type="button"
        aria-label="Filtrar por período"
        className={cn(
          "flex h-8 max-w-full items-center gap-1 rounded-full border border-input bg-background pr-3 pl-3 text-xs whitespace-nowrap transition-colors outline-none select-none hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring dark:bg-input/30",
          ativo && "border-primary/40 bg-primary/5 hover:bg-primary/10 dark:bg-primary/10",
        )}
      >
        <Icone icon={Calendar03Icon} aria-hidden className="size-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Período:</span>
        <span className="min-w-0 max-w-56 truncate font-medium">{rotuloDoPeriodo(valor)}</span>
        <Icone
          icon={ArrowDown01Icon}
          aria-hidden
          className="pointer-events-none size-4 text-muted-foreground"
        />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-auto max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
      >
        <div className="flex flex-col sm:flex-row">
          <div
            role="group"
            aria-label="Atalhos de período"
            className="grid grid-cols-2 gap-x-1 border-b p-1.5 sm:flex sm:w-44 sm:flex-col sm:border-r sm:border-b-0"
          >
            {GRUPOS_DE_ATALHOS.map((grupo, i) => (
              <div
                key={grupo[0]!.id}
                className={cn(
                  "contents sm:flex sm:flex-col",
                  i > 0 && "sm:mt-1.5 sm:border-t sm:pt-1.5",
                )}
              >
                {grupo.map((atalho) => {
                  const escolhido = "atalho" in valor && valor.atalho === atalho.id;
                  return (
                    <button
                      key={atalho.id}
                      type="button"
                      aria-pressed={escolhido}
                      onClick={() => escolherAtalho(atalho.id)}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                        escolhido && "bg-primary/10 font-medium text-foreground hover:bg-primary/15",
                      )}
                    >
                      {atalho.rotulo}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex flex-col">
            <Calendar
              mode="range"
              locale={ptBR}
              numberOfMonths={telaLarga ? 2 : 1}
              defaultMonth={telaLarga ? subMonths(fimVisivel, 1) : fimVisivel}
              endMonth={hoje}
              disabled={{ after: hoje }}
              selected={rascunho}
              onSelect={setRascunho}
              className="p-3"
            />

            <div className="flex items-center justify-between gap-3 border-t px-3 py-2.5">
              <span className="text-xs text-muted-foreground tabular-nums">
                {rascunho?.from
                  ? rotuloDoPeriodo({
                      de: paraIso(rascunho.from),
                      ate: paraIso(rascunho.to ?? rascunho.from),
                    })
                  : "Escolha o início e o fim"}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
                  Cancelar
                </Button>
                <Button size="sm" disabled={!rascunho?.from} onClick={aplicar}>
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
