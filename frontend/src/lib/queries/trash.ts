"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post } from "../api";
import type {
  ConteudoDaLixeira,
  ResultadoDoLoteDaLixeira,
  SelecaoDaLixeira,
} from "../types";
import { chavesDeProjeto } from "./projects";
import { chavesDeTarefa } from "./tasks";

export const chavesDaLixeira = {
  conteudo: ["lixeira"] as const,
};

export function useLixeira() {
  return useQuery({
    queryKey: chavesDaLixeira.conteudo,
    // A página mostra tudo de uma vez: os itens somem em 30 dias, então o
    // teto do servidor (500 por tipo) basta.
    queryFn: () => get<ConteudoDaLixeira>("/api/lixeira?limite=500"),
  });
}

/** Restaurar ou apagar muda a Lixeira e também as listagens de origem. */
function useInvalidarTudo() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: chavesDaLixeira.conteudo });
    queryClient.invalidateQueries({ queryKey: chavesDeProjeto.todas });
    queryClient.invalidateQueries({ queryKey: chavesDeTarefa.todas });
  };
}

export function useRestaurarProjeto() {
  const invalidar = useInvalidarTudo();
  return useMutation({
    mutationFn: (projectId: string) =>
      post<{ projectId: string; tarefasRestauradas: number }>(
        `/api/lixeira/projetos/${projectId}/restaurar`,
      ),
    onSuccess: invalidar,
  });
}

export function useRestaurarTarefa() {
  const invalidar = useInvalidarTudo();
  return useMutation({
    mutationFn: (taskId: string) =>
      post<{ taskId: string }>(`/api/lixeira/tarefas/${taskId}/restaurar`),
    onSuccess: invalidar,
  });
}

export function useExcluirProjetoDefinitivamente() {
  const invalidar = useInvalidarTudo();
  return useMutation({
    mutationFn: (projectId: string) => del(`/api/lixeira/projetos/${projectId}`),
    onSuccess: invalidar,
  });
}

export function useExcluirTarefaDefinitivamente() {
  const invalidar = useInvalidarTudo();
  return useMutation({
    mutationFn: (taskId: string) => del(`/api/lixeira/tarefas/${taskId}`),
    onSuccess: invalidar,
  });
}

/**
 * Lotes: o servidor processa item a item e devolve o que deu certo e o que
 * falhou. A invalidação roda mesmo com falhas parciais — o que passou mudou.
 */
export function useRestaurarEmLote() {
  const invalidar = useInvalidarTudo();
  return useMutation({
    mutationFn: (selecao: SelecaoDaLixeira) =>
      post<ResultadoDoLoteDaLixeira>("/api/lixeira/lote/restaurar", selecao),
    onSettled: invalidar,
  });
}

export function useExcluirEmLoteDefinitivamente() {
  const invalidar = useInvalidarTudo();
  return useMutation({
    mutationFn: (selecao: SelecaoDaLixeira) =>
      post<ResultadoDoLoteDaLixeira>("/api/lixeira/lote/excluir", selecao),
    onSettled: invalidar,
  });
}

export function useEsvaziarLixeira() {
  const invalidar = useInvalidarTudo();
  return useMutation({
    mutationFn: () =>
      post<{ projetosApagados: number; tarefasApagadas: number }>(
        "/api/lixeira/esvaziar",
      ),
    onSettled: invalidar,
  });
}
