"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post } from "../api";
import type {
  ConvitePendente,
  DetalheDaEquipe,
  EquipesAgrupadas,
  PapelEquipe,
} from "../types";

/**
 * Equipes.
 *
 * Não há atualização em tempo real: depois de cada escrita, as consultas
 * afetadas são invalidadas para que a tela reflita o servidor.
 */

export const chavesDeEquipe = {
  todas: ["equipes"] as const,
  lista: () => [...chavesDeEquipe.todas, "lista"] as const,
  detalhe: (id: string) => [...chavesDeEquipe.todas, "detalhe", id] as const,
  convites: (id: string) => [...chavesDeEquipe.todas, "convites", id] as const,
};

export function useEquipes() {
  return useQuery({
    queryKey: chavesDeEquipe.lista(),
    queryFn: () => get<EquipesAgrupadas>("/api/equipes"),
  });
}

export function useEquipe(teamId: string | null) {
  return useQuery({
    queryKey: chavesDeEquipe.detalhe(teamId ?? ""),
    queryFn: () => get<DetalheDaEquipe>(`/api/equipes/${teamId}`),
    enabled: Boolean(teamId),
  });
}

export function useConvitesDaEquipe(teamId: string | null, habilitado = true) {
  return useQuery({
    queryKey: chavesDeEquipe.convites(teamId ?? ""),
    queryFn: () => get<ConvitePendente[]>(`/api/equipes/${teamId}/convites`),
    enabled: Boolean(teamId) && habilitado,
  });
}

export function useCriarEquipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: { name: string; description?: string }) =>
      post<{ id: string; name: string }>("/api/equipes", dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEquipe.lista() });
    },
  });
}

export function useAtualizarEquipe(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: { name?: string; description?: string | null }) =>
      patch(`/api/equipes/${teamId}`, dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEquipe.detalhe(teamId) });
      queryClient.invalidateQueries({ queryKey: chavesDeEquipe.lista() });
    },
  });
}

export function useAlterarPapel(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membroId, role }: { membroId: string; role: PapelEquipe }) =>
      patch(`/api/equipes/${teamId}/membros/${membroId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEquipe.detalhe(teamId) });
    },
  });
}

export function useRemoverMembro(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membroId: string) =>
      del(`/api/equipes/${teamId}/membros/${membroId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEquipe.detalhe(teamId) });
      // Sair de uma equipe pode tirar o usuário de projetos dela.
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
    },
  });
}

export function useTransferirPropriedade(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (novoDonoId: string) =>
      post(`/api/equipes/${teamId}/transferir`, { novoDonoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEquipe.detalhe(teamId) });
      queryClient.invalidateQueries({ queryKey: chavesDeEquipe.lista() });
    },
  });
}

export function useSairDaEquipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => post(`/api/equipes/${teamId}/sair`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEquipe.lista() });
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
    },
  });
}

export function useExcluirEquipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => del(`/api/equipes/${teamId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEquipe.lista() });
    },
  });
}

export function useConvidarParaEquipe(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: { email: string; role: PapelEquipe }) =>
      post(`/api/equipes/${teamId}/convites`, dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEquipe.convites(teamId) });
    },
  });
}

export function useCancelarConvite(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conviteId: string) =>
      del(`/api/equipes/${teamId}/convites/${conviteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEquipe.convites(teamId) });
    },
  });
}
