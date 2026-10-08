"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post } from "../api";

/** Situação da integração com o Google Agenda do usuário logado. */
export interface IntegracaoGoogle {
  /** O servidor tem credenciais do Google configuradas. */
  disponivel: boolean;
  conectada: boolean;
  googleEmail: string | null;
  status: "ATIVA" | "PRECISA_RECONECTAR" | null;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Reuniões futuras organizadas pela pessoa que perdem o Meet ao desconectar. */
  reunioesComMeetFuturas: number;
}

const CHAVE = ["integracoes", "google"] as const;

export function useIntegracaoGoogle() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: () => get<IntegracaoGoogle>("/api/integracoes/google"),
  });
}

/**
 * Começa a conexão: o servidor só monta o endereço do Google depois do
 * consentimento dado no diálogo. A página então vai para o Google.
 */
export function useConectarGoogle() {
  return useMutation({
    mutationFn: async () => {
      const { url } = await post<{ url: string }>("/api/integracoes/google/conectar", {
        consentimento: true,
      });
      window.location.href = url;
    },
  });
}

export function useDesconectarGoogle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => del("/api/integracoes/google"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVE });
      // As reuniões perderam o link do Meet.
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });
}
