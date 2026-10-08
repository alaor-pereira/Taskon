"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, put } from "../api";
import type { Visualizacao } from "../types";

/**
 * Visualização escolhida (Cards, Kanban ou Lista).
 *
 * Fica no banco, por usuário e por página: o prompt pede que a escolha seja
 * respeitada ao voltar, e guardá-la só no navegador a perderia em outro
 * dispositivo. As abas abertas, por serem conveniência local, ficam no
 * localStorage.
 */

type TipoDeEntidade = "PROJETO" | "TAREFA";

/** Páginas de listagem, que não pertencem a um projeto ou tarefa. */
export type PaginaComVisualizacao = "TODOS_PROJETOS" | "TODAS_TAREFAS";

/** Visualização de um projeto ou tarefa. */
export function useVisualizacao(
  tipo: TipoDeEntidade,
  entityId: string | null,
  padrao: Visualizacao = "CARDS",
) {
  return usePreferenciaDeVisualizacao(
    ["preferencias", "visualizacao", tipo, entityId ?? ""],
    entityId ? `/api/preferencias/visualizacao/${tipo}/${entityId}` : null,
    padrao,
  );
}

/** Visualização de "Todos os projetos" ou "Todas as tarefas". */
export function useVisualizacaoDaPagina(
  pagina: PaginaComVisualizacao,
  padrao: Visualizacao,
) {
  return usePreferenciaDeVisualizacao(
    ["preferencias", "visualizacao-pagina", pagina],
    `/api/preferencias/visualizacao-pagina/${pagina}`,
    padrao,
  );
}

function usePreferenciaDeVisualizacao(
  chave: readonly string[],
  /** Nulo enquanto o recurso ainda não é conhecido. */
  url: string | null,
  padrao: Visualizacao,
) {
  const queryClient = useQueryClient();

  const consulta = useQuery({
    queryKey: chave,
    queryFn: () => get<{ view: Visualizacao | null }>(url!),
    enabled: Boolean(url),
    // A preferência muda pouco e só pelo próprio usuário.
    staleTime: 5 * 60_000,
  });

  const salvar = useMutation({
    mutationFn: (view: Visualizacao) => put(url!, { view }),
    onMutate: async (view) => {
      // A troca de visualização precisa ser imediata: esperar o servidor
      // deixaria o botão parecendo travado.
      await queryClient.cancelQueries({ queryKey: chave });
      const anterior = queryClient.getQueryData(chave);
      queryClient.setQueryData(chave, { view });
      return { anterior };
    },
    onError: (_erro, _view, contexto) => {
      if (contexto?.anterior !== undefined) {
        queryClient.setQueryData(chave, contexto.anterior);
      }
    },
  });

  return {
    visualizacao: consulta.data?.view ?? padrao,
    carregando: consulta.isPending,
    definir: (view: Visualizacao) => salvar.mutate(view),
  };
}

// --- Notificações -----------------------------------------------------------

const CHAVE_NOTIFICACOES = ["preferencias", "notificacoes"] as const;

/**
 * Avisos que o usuário desligou em Configurações > Notificações. A escolha é
 * só dele: o servidor deixa de criar esses avisos para ele, e mais ninguém.
 */
export function useNotificacoesDesativadas() {
  const queryClient = useQueryClient();

  const consulta = useQuery({
    queryKey: CHAVE_NOTIFICACOES,
    queryFn: () => get<{ desativadas: string[] }>("/api/preferencias/notificacoes"),
  });

  const salvar = useMutation({
    mutationFn: (desativadas: string[]) =>
      put("/api/preferencias/notificacoes", { desativadas }),
    onMutate: async (desativadas) => {
      // O interruptor precisa responder na hora; se o servidor recusar, volta.
      await queryClient.cancelQueries({ queryKey: CHAVE_NOTIFICACOES });
      const anterior = queryClient.getQueryData(CHAVE_NOTIFICACOES);
      queryClient.setQueryData(CHAVE_NOTIFICACOES, { desativadas });
      return { anterior };
    },
    onError: (_erro, _valor, contexto) => {
      if (contexto?.anterior !== undefined) {
        queryClient.setQueryData(CHAVE_NOTIFICACOES, contexto.anterior);
      }
    },
  });

  return {
    desativadas: consulta.data?.desativadas ?? [],
    carregando: consulta.isPending,
    erro: salvar.error,
    definir: (desativadas: string[]) => salvar.mutate(desativadas),
  };
}
