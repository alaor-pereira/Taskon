"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "../api";

/** Se o usuário logado já aceitou a versão vigente dos documentos legais. */
export interface SituacaoDosTermos {
  versaoAtual: string;
  aceitouEm: string | null;
  precisaAceitar: boolean;
}

const CHAVE = ["termos", "situacao"] as const;

export function useSituacaoDosTermos() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: () => get<SituacaoDosTermos>("/api/termos/situacao"),
    staleTime: Infinity,
  });
}

/** `CADASTRO` quando vem do checkbox do /cadastrar (login social); senão, re-aceite. */
export function useAceitarTermos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (origem: "CADASTRO" | "REACEITE" = "REACEITE") =>
      post<SituacaoDosTermos>("/api/termos/aceite", { origem }),
    onSuccess: (situacao) => queryClient.setQueryData(CHAVE, situacao),
  });
}
