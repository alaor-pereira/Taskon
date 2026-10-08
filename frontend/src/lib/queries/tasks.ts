"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post, put } from "../api";
import type {
  Dificuldade,
  ListaPorPrioridade,
  Prioridade,
  StatusTarefa,
  Tarefa,
  TarefaDetalhada,
  TarefaRecente,
} from "../types";
import { chavesDeProjeto } from "./projects";

export const chavesDeTarefa = {
  todas: ["tarefas"] as const,
  doProjeto: (projectId: string) =>
    [...chavesDeTarefa.todas, "projeto", projectId] as const,
  detalhe: (taskId: string) => [...chavesDeTarefa.todas, "detalhe", taskId] as const,
  vencemHoje: () => [...chavesDeTarefa.todas, "vencem-hoje"] as const,
  vencidas: () => [...chavesDeTarefa.todas, "vencidas"] as const,
  recentes: () => [...chavesDeTarefa.todas, "recentes"] as const,
  porPrioridade: (p: Prioridade) =>
    [...chavesDeTarefa.todas, "prioridade", p] as const,
  todasAsTarefas: (projectId?: string) =>
    [...chavesDeTarefa.todas, "todas", projectId ?? null] as const,
};

export function useTarefasDoProjeto(projectId: string | null) {
  return useQuery({
    queryKey: chavesDeTarefa.doProjeto(projectId ?? ""),
    queryFn: () => get<Tarefa[]>(`/api/projetos/${projectId}/tarefas`),
    enabled: Boolean(projectId),
  });
}

export function useTarefa(taskId: string | null) {
  return useQuery({
    queryKey: chavesDeTarefa.detalhe(taskId ?? ""),
    queryFn: () => get<TarefaDetalhada>(`/api/tarefas/${taskId}`),
    enabled: Boolean(taskId),
  });
}

export function useVencemHoje() {
  return useQuery({
    queryKey: chavesDeTarefa.vencemHoje(),
    queryFn: () => get<Tarefa[]>("/api/tarefas/vencem-hoje"),
  });
}

export function useVencidas() {
  return useQuery({
    queryKey: chavesDeTarefa.vencidas(),
    queryFn: () => get<Tarefa[]>("/api/tarefas/vencidas"),
  });
}

/** Conjunto completo, sem limite, para a página "Ver todas as tarefas". */
export function useTodasAsTarefas(projectId?: string) {
  return useQuery({
    queryKey: chavesDeTarefa.todasAsTarefas(projectId),
    queryFn: () =>
      get<Tarefa[]>(
        `/api/tarefas/todas${projectId ? `?projectId=${projectId}` : ""}`,
      ),
  });
}

export function useRecentes() {
  return useQuery({
    queryKey: chavesDeTarefa.recentes(),
    queryFn: () => get<TarefaRecente[]>("/api/tarefas/recentes"),
  });
}

export function usePorPrioridade(priority: Prioridade) {
  return useQuery({
    queryKey: chavesDeTarefa.porPrioridade(priority),
    queryFn: () =>
      get<ListaPorPrioridade>(`/api/tarefas/por-prioridade/${priority}`),
  });
}

/**
 * Invalida tudo o que uma escrita de tarefa pode ter afetado.
 *
 * Uma tarefa aparece no projeto, nas listas de prioridade, em "Vencem Hoje" e
 * em "Recentes" ao mesmo tempo; invalidar só a origem deixaria as outras
 * desatualizadas até o próximo foco da janela.
 */
function useInvalidarTarefas() {
  const queryClient = useQueryClient();
  return (projectId?: string) => {
    queryClient.invalidateQueries({ queryKey: chavesDeTarefa.todas });
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.detalhe(projectId) });
    }
  };
}

export function useCriarTarefa() {
  const invalidar = useInvalidarTarefas();
  return useMutation({
    mutationFn: (dados: {
      projectId?: string | null;
      parentId?: string | null;
      title: string;
      description?: string | null;
      status?: StatusTarefa;
      priority?: Prioridade;
      difficulty?: Dificuldade | null;
      dueDate?: string | null;
      assigneeIds?: string[];
    }) => post<Tarefa>("/api/tarefas", dados),
    onSuccess: (tarefa) => invalidar(tarefa.projectId),
  });
}

export function useAtualizarTarefa() {
  const invalidar = useInvalidarTarefas();
  return useMutation({
    mutationFn: ({
      taskId,
      ...dados
    }: {
      taskId: string;
      title?: string;
      description?: string | null;
      priority?: Prioridade;
      difficulty?: Dificuldade | null;
      dueDate?: string | null;
      status?: StatusTarefa;
      /** Obrigatória: o servidor recusa a gravação se a versão mudou. */
      version: number;
      concluirComSubtarefasAbertas?: boolean;
    }) => patch<Tarefa>(`/api/tarefas/${taskId}`, dados),
    onSuccess: (tarefa) => invalidar(tarefa.projectId),
  });
}

export function useMoverTarefa() {
  const invalidar = useInvalidarTarefas();
  return useMutation({
    mutationFn: ({
      taskId,
      status,
      antesDeId,
    }: {
      taskId: string;
      status: StatusTarefa;
      antesDeId?: string | null;
    }) => post<Tarefa>(`/api/tarefas/${taskId}/mover`, { status, antesDeId }),
    onSuccess: (tarefa) => invalidar(tarefa.projectId),
  });
}

export function useDefinirResponsaveis(projectId?: string) {
  const invalidar = useInvalidarTarefas();
  return useMutation({
    mutationFn: ({
      taskId,
      assigneeIds,
    }: {
      taskId: string;
      assigneeIds: string[];
    }) => put(`/api/tarefas/${taskId}/responsaveis`, { assigneeIds }),
    onSuccess: () => invalidar(projectId),
  });
}

export function useExcluirTarefa(projectId?: string) {
  const invalidar = useInvalidarTarefas();
  return useMutation({
    mutationFn: (taskId: string) => del(`/api/tarefas/${taskId}`),
    onSuccess: () => invalidar(projectId),
  });
}
