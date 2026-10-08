"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "../api";
import type { Dificuldade, Prioridade, StatusTarefa } from "../types";

export type EscopoDoDashboard = "MINHAS" | "TODAS";
/** Tamanho de cada barra do fluxo, escolhido pelo servidor conforme o período. */
export type GranularidadeDoFluxo = "dia" | "semana" | "mes";

export interface DadosDoDashboard {
  filtros: {
    escopo: EscopoDoDashboard;
    projectId: string | null;
    /** AAAA-MM-DD; `null` nos dois quando vale todo o período. */
    de: string | null;
    ate: string | null;
  };
  porStatus: Array<{ status: StatusTarefa; total: number }>;
  porPrioridade: Array<{ priority: Prioridade; total: number }>;
  prazos: {
    atrasadas: number;
    proximosSeteDias: number;
    semTerminoDefinido: number;
  };
  /** Um balde por dia, semana ou mês do período, inclusive os sem movimento. */
  fluxo: {
    granularidade: GranularidadeDoFluxo;
    baldes: Array<{ inicio: string; criadas: number; concluidas: number }>;
  };
  /** Projetos com mais tarefas (até 3), com a contagem por etapa. */
  etapasPorProjeto: Array<{
    projectId: string;
    nome: string;
    isInbox: boolean;
    total: number;
    porStatus: Record<StatusTarefa, number>;
  }>;
  porDificuldade: Array<{ difficulty: Dificuldade | "NAO_ESTIMADA"; total: number }>;
  projetosPorEtapa: Array<{ status: StatusTarefa; total: number }>;
  noPrazo: { concluidas: number; comPrazo: number; dentroDoPrazo: number };
  /** Carga do time: ignora o escopo, respeita o filtro de projeto. */
  cargaPorResponsavel: {
    pessoas: Array<{
      userId: string;
      nome: string;
      image: string | null;
      ALTA: number;
      MEDIA: number;
      BAIXA: number;
    }>;
    semResponsavel: number;
  };
  /**
   * Mapa de calor: o trecho do período que ele cobre (até 12 meses, contados
   * do fim) e os dias com conclusão nele (AAAA-MM-DD, no fuso da pessoa).
   */
  mapaDeEntregas: {
    inicio: string;
    fim: string;
    dias: Array<{ dia: string; total: number }>;
  };
  progressoPorProjeto: Array<{
    projectId: string;
    nome: string;
    isInbox: boolean;
    total: number;
    concluidas: number;
    percentual: number;
  }>;
  proximasReunioes: Array<{
    eventId: string;
    title: string;
    inicio: string;
    participantes: number;
  }>;
}

export interface FiltrosDoDashboard {
  escopo?: EscopoDoDashboard;
  projectId?: string;
  /** AAAA-MM-DD, os dois juntos; sem eles, todo o período. */
  de?: string;
  ate?: string;
}

export function useDashboard(filtros: FiltrosDoDashboard) {
  const params = new URLSearchParams();
  if (filtros.escopo) params.set("escopo", filtros.escopo);
  if (filtros.projectId) params.set("projectId", filtros.projectId);
  if (filtros.de && filtros.ate) {
    params.set("de", filtros.de);
    params.set("ate", filtros.ate);
  }

  return useQuery({
    queryKey: ["dashboard", filtros],
    queryFn: () => get<DadosDoDashboard>(`/api/dashboard?${params.toString()}`),
    // Segura o resultado anterior enquanto o novo chega: trocar um filtro não
    // deve piscar esqueleto nem deslocar o layout.
    placeholderData: (anterior) => anterior,
  });
}

export function useProjetosDoFiltro() {
  return useQuery({
    queryKey: ["dashboard", "projetos"],
    queryFn: () =>
      get<Array<{ id: string; name: string; isInbox: boolean }>>(
        "/api/dashboard/projetos",
      ),
    staleTime: 60_000,
  });
}
