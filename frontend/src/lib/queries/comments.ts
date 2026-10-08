"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post } from "../api";
import type { Comentario, Mencionavel } from "../types";

export const chavesDeComentario = {
  daTarefa: (taskId: string) => ["comentarios", taskId] as const,
  mencionaveis: (taskId: string) => ["comentarios", taskId, "mencionaveis"] as const,
};

export function useComentarios(taskId: string | null) {
  return useQuery({
    queryKey: chavesDeComentario.daTarefa(taskId ?? ""),
    queryFn: () => get<Comentario[]>(`/api/comentarios/tarefa/${taskId}`),
    enabled: Boolean(taskId),
  });
}

/** Membros do projeto: só eles podem ser mencionados. */
export function useMencionaveis(taskId: string | null) {
  return useQuery({
    queryKey: chavesDeComentario.mencionaveis(taskId ?? ""),
    queryFn: () => get<Mencionavel[]>(`/api/comentarios/tarefa/${taskId}/mencionaveis`),
    enabled: Boolean(taskId),
    staleTime: 5 * 60_000,
  });
}

export function useComentar(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bodyMd: string) =>
      post<Comentario>(`/api/comentarios/tarefa/${taskId}`, { bodyMd }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeComentario.daTarefa(taskId) });
    },
  });
}

export function useEditarComentario(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, bodyMd }: { commentId: string; bodyMd: string }) =>
      patch<Comentario>(`/api/comentarios/${commentId}`, { bodyMd }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeComentario.daTarefa(taskId) });
    },
  });
}

export function useRemoverComentario(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => del(`/api/comentarios/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeComentario.daTarefa(taskId) });
    },
  });
}
