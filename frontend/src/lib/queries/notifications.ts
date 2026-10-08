"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "../api";
import type { ConviteRecebido, ListaDeNotificacoes } from "../types";
import { chavesDeEquipe } from "./teams";

export const chavesDeNotificacao = {
  todas: ["notificacoes"] as const,
};

export const chavesDeConvite = {
  recebidos: ["convites", "recebidos"] as const,
};

export function useNotificacoes() {
  return useQuery({
    queryKey: chavesDeNotificacao.todas,
    queryFn: () => get<ListaDeNotificacoes>("/api/notificacoes"),
    // Sem tempo real: o contador se atualiza ao voltar para a janela e a cada
    // dois minutos, o que basta para avisos que não são urgentes.
    refetchInterval: 120_000,
  });
}

export function useMarcarNotificacaoLida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post(`/api/notificacoes/${id}/lida`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeNotificacao.todas });
    },
  });
}

export function useMarcarTodasLidas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => post<{ marcadas: number }>("/api/notificacoes/lidas"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeNotificacao.todas });
    },
  });
}

export function useConvitesRecebidos() {
  return useQuery({
    queryKey: chavesDeConvite.recebidos,
    queryFn: () => get<ConviteRecebido[]>("/api/convites"),
  });
}

export function useResponderConvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, aceitar }: { id: string; aceitar: boolean }) =>
      post(`/api/convites/${id}/${aceitar ? "aceitar" : "recusar"}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeConvite.recebidos });
      queryClient.invalidateQueries({ queryKey: chavesDeNotificacao.todas });
      // Aceitar um convite muda a lista de equipes.
      queryClient.invalidateQueries({ queryKey: chavesDeEquipe.lista() });
    },
  });
}
