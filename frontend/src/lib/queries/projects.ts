"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post } from "../api";
import type {
  DetalheDoProjeto,
  Dificuldade,
  PapelProjeto,
  Prioridade,
  ProjetoComEscopo,
  ProjetosAgrupados,
  StatusTarefa,
  UsuarioResumo,
} from "../types";

export const chavesDeProjeto = {
  todas: ["projetos"] as const,
  lista: () => [...chavesDeProjeto.todas, "lista"] as const,
  todos: () => [...chavesDeProjeto.todas, "todos"] as const,
  detalhe: (id: string) => [...chavesDeProjeto.todas, "detalhe", id] as const,
  candidatos: (id: string) => [...chavesDeProjeto.todas, "candidatos", id] as const,
};

export function useProjetos() {
  return useQuery({
    queryKey: chavesDeProjeto.lista(),
    queryFn: () => get<ProjetosAgrupados>("/api/projetos"),
  });
}

/** Conjunto completo, sem limite, para a página "Ver todos os projetos". */
export function useTodosOsProjetos() {
  return useQuery({
    queryKey: chavesDeProjeto.todos(),
    queryFn: () => get<ProjetoComEscopo[]>("/api/projetos/todos"),
  });
}

export function useProjeto(projectId: string | null) {
  return useQuery({
    queryKey: chavesDeProjeto.detalhe(projectId ?? ""),
    queryFn: () => get<DetalheDoProjeto>(`/api/projetos/${projectId}`),
    enabled: Boolean(projectId),
  });
}

export function useCandidatosAMembro(projectId: string | null, habilitado = true) {
  return useQuery({
    queryKey: chavesDeProjeto.candidatos(projectId ?? ""),
    queryFn: () => get<UsuarioResumo[]>(`/api/projetos/${projectId}/candidatos`),
    enabled: Boolean(projectId) && habilitado,
  });
}

export function useCriarProjeto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: {
      name: string;
      description?: string;
      teamId?: string | null;
      priority?: Prioridade;
      difficulty?: Dificuldade | null;
      dueDate?: string | null;
    }) => post<{ id: string; name: string }>("/api/projetos", dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.lista() });
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.todos() });
    },
  });
}

export function useAtualizarProjeto(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: {
      name?: string;
      description?: string | null;
      status?: StatusTarefa;
      priority?: Prioridade;
      difficulty?: Dificuldade | null;
      dueDate?: string | null;
    }) => patch(`/api/projetos/${projectId}`, dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.detalhe(projectId) });
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.lista() });
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.todos() });
    },
  });
}

/**
 * Muda a etapa do projeto, para o arrastar-e-soltar do kanban de projetos —
 * diferente de `useAtualizarProjeto`, que precisa do id fixado na criação do
 * hook, aqui o id vem por chamada, já que uma lista arrasta projetos variados.
 */
export function useMoverProjeto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, status }: { projectId: string; status: StatusTarefa }) =>
      patch(`/api/projetos/${projectId}`, { status }),
    onSuccess: (_dado, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.detalhe(projectId) });
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.lista() });
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.todos() });
    },
  });
}

export function useExcluirProjeto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => del(`/api/projetos/${projectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.lista() });
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.todos() });
      // Excluir o projeto leva as tarefas junto: as listas da sidebar mudam.
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    },
  });
}

export function useAdicionarMembroDoProjeto(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: { userId: string; role: PapelProjeto }) =>
      post(`/api/projetos/${projectId}/membros`, dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.detalhe(projectId) });
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.candidatos(projectId) });
    },
  });
}

export function useAlterarPapelNoProjeto(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membroId, role }: { membroId: string; role: PapelProjeto }) =>
      patch(`/api/projetos/${projectId}/membros/${membroId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.detalhe(projectId) });
    },
  });
}

export function useRemoverMembroDoProjeto(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membroId: string) =>
      del(`/api/projetos/${projectId}/membros/${membroId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.detalhe(projectId) });
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.candidatos(projectId) });
      // Quem sai deixa de ser responsável pelas tarefas do projeto.
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    },
  });
}

export function useTransferirProjeto(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (novoDonoId: string) =>
      post(`/api/projetos/${projectId}/transferir`, { novoDonoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.detalhe(projectId) });
      queryClient.invalidateQueries({ queryKey: chavesDeProjeto.lista() });
    },
  });
}
