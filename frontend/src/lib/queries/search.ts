"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "../api";
import type { ResultadoDaBusca } from "../types";

/**
 * Busca da barra lateral.
 *
 * O resultado já vem filtrado pela permissão no servidor: o cliente nunca
 * recebe o que não pode ver, nem para descartar depois.
 */
export function useBusca(termo: string) {
  const busca = termo.trim();

  return useQuery({
    queryKey: ["busca", busca],
    queryFn: () => get<ResultadoDaBusca>(`/api/busca?q=${encodeURIComponent(busca)}`),
    // Abaixo de dois caracteres o servidor devolveria quase tudo; nem chamamos.
    enabled: busca.length >= 2,
    // O termo muda a cada tecla; um resultado de poucos segundos ainda serve.
    staleTime: 10_000,
  });
}
