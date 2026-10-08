"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { del, get, put } from "../api";
import { updateUser } from "../auth-client";

/** Números e dados de leitura da página "Meu perfil". */
export interface ResumoDoPerfil {
  tarefasConcluidas: number;
  projetosConcluidos: number;
  membroDesde: string;
  /** Provedores conectados: "credential" (e-mail e senha), "google", "github". */
  contas: string[];
  temSenha: boolean;
}

const CHAVE_RESUMO = ["perfil", "resumo"] as const;

export function useResumoDoPerfil() {
  return useQuery({
    queryKey: CHAVE_RESUMO,
    queryFn: () => get<ResumoDoPerfil>("/api/perfil/resumo"),
  });
}

/**
 * Troca a foto: o backend guarda a imagem e devolve o endereço que a serve;
 * em seguida o endereço vai para o usuário pelo Better Auth, que já atualiza
 * a sessão — e com ela o avatar do rodapé e dos chips.
 */
export function useSalvarAvatar() {
  return useMutation({
    mutationFn: async (dataUrl: string) => {
      const { url } = await put<{ url: string }>("/api/perfil/avatar", { imagem: dataUrl });
      const { error } = await updateUser({ image: url });
      if (error) throw new Error(error.message ?? "Não foi possível salvar a foto.");
      return url;
    },
  });
}

/** O que precisa acontecer antes de a conta poder ser excluída. */
export interface PreparacaoDaExclusao {
  /** Equipes de que é dono: precisam ser transferidas ou excluídas. */
  equipes: { id: string; nome: string }[];
  /** Projetos com outras pessoas de que é dono: idem. */
  projetos: { id: string; nome: string }[];
  temSenha: boolean;
  /** Sem senha, a confirmação exige um login feito nas últimas 24 horas. */
  sessaoRecente: boolean;
}

export function usePreparacaoDaExclusao(ativo: boolean) {
  return useQuery({
    queryKey: ["perfil", "exclusao"],
    queryFn: () => get<PreparacaoDaExclusao>("/api/perfil/exclusao"),
    enabled: ativo,
    // Cada abertura do diálogo confere de novo: a pessoa pode ter acabado
    // de transferir uma equipe.
    staleTime: 0,
  });
}

export function useExcluirConta() {
  return useMutation({
    mutationFn: (confirmacao: { email: string; senha?: string }) =>
      del("/api/perfil/conta", confirmacao),
  });
}

export function useRemoverAvatar() {
  return useMutation({
    mutationFn: async () => {
      await del("/api/perfil/avatar");
      const { error } = await updateUser({ image: null });
      if (error) throw new Error(error.message ?? "Não foi possível remover a foto.");
    },
  });
}

