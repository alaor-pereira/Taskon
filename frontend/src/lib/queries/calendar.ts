"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post } from "../api";
import type {
  EscopoDaAlteracao,
  Evento,
  OcorrenciaDeAgenda,
  Recorrencia,
  RespostaDeParticipante,
  TipoDeEvento,
  UsuarioResumo,
} from "../types";

export const chavesDaAgenda = {
  todas: ["agenda"] as const,
  hoje: () => [...chavesDaAgenda.todas, "hoje"] as const,
  proximas: () => [...chavesDaAgenda.todas, "proximas"] as const,
  reunioes: () => [...chavesDaAgenda.todas, "reunioes"] as const,
  evento: (id: string) => [...chavesDaAgenda.todas, "evento", id] as const,
  convidaveis: () => [...chavesDaAgenda.todas, "convidaveis"] as const,
};

export function useAtividadesDeHoje() {
  return useQuery({
    queryKey: chavesDaAgenda.hoje(),
    queryFn: () => get<OcorrenciaDeAgenda[]>("/api/agenda/hoje"),
  });
}

export function useProximasAtividades() {
  return useQuery({
    queryKey: chavesDaAgenda.proximas(),
    queryFn: () => get<OcorrenciaDeAgenda[]>("/api/agenda/proximas"),
  });
}

export function useReunioesAgendadas() {
  return useQuery({
    queryKey: chavesDaAgenda.reunioes(),
    queryFn: () => get<OcorrenciaDeAgenda[]>("/api/agenda/reunioes"),
  });
}

/**
 * Intervalo livre, para a visualização de calendário completa. `inicio`/`fim`
 * precisam ser ISO datetime completos — é o que a rota espera.
 */
export function useAgendaDoPeriodo(
  inicio: string | null,
  fim: string | null,
  kind?: TipoDeEvento,
) {
  return useQuery({
    queryKey: [...chavesDaAgenda.todas, "periodo", inicio, fim, kind] as const,
    queryFn: () => {
      const params = new URLSearchParams({ inicio: inicio!, fim: fim! });
      if (kind) params.set("kind", kind);
      return get<OcorrenciaDeAgenda[]>(`/api/agenda/periodo?${params}`);
    },
    enabled: Boolean(inicio && fim),
  });
}

export function useEvento(eventId: string | null) {
  return useQuery({
    queryKey: chavesDaAgenda.evento(eventId ?? ""),
    queryFn: () =>
      get<Evento & { vinculo: unknown }>(`/api/agenda/${eventId}`),
    enabled: Boolean(eventId),
  });
}

export function useConvidaveis(habilitado = true) {
  return useQuery({
    queryKey: chavesDaAgenda.convidaveis(),
    queryFn: () => get<UsuarioResumo[]>("/api/agenda/convidaveis"),
    enabled: habilitado,
    staleTime: 5 * 60_000,
  });
}

/** Qualquer escrita afeta as três seções e a agenda inteira. */
function useInvalidarAgenda() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: chavesDaAgenda.todas });
}

export interface NovoEvento {
  kind: TipoDeEvento;
  title: string;
  description?: string | null;
  locationOrLink?: string | null;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  timezone: string;
  recorrencia?: Recorrencia | null;
  taskId?: string | null;
  projectId?: string | null;
  participantIds?: string[];
  /** Gerar link do Google Meet (organizador com o Google Agenda conectado). */
  meet?: boolean;
}

export function useCriarEvento() {
  const invalidar = useInvalidarAgenda();
  return useMutation({
    mutationFn: (dados: NovoEvento) => post<Evento>("/api/agenda", dados),
    onSuccess: invalidar,
  });
}

export function useAtualizarEvento() {
  const invalidar = useInvalidarAgenda();
  return useMutation({
    mutationFn: ({
      eventId,
      ...dados
    }: {
      eventId: string;
      title?: string;
      description?: string | null;
      locationOrLink?: string | null;
      startsAt?: string;
      endsAt?: string;
      recorrencia?: Recorrencia | null;
      /** Ocorrência afetada. Obrigatória fora de "TODAS". */
      ocorrencia?: string;
      escopo?: EscopoDaAlteracao;
      /** Liga ou desliga o Google Meet. Omitido: não mexe. */
      meet?: boolean;
    }) => patch<Evento>(`/api/agenda/${eventId}`, dados),
    onSuccess: invalidar,
  });
}

export function useExcluirEvento() {
  const invalidar = useInvalidarAgenda();
  return useMutation({
    mutationFn: ({
      eventId,
      escopo,
      ocorrencia,
    }: {
      eventId: string;
      escopo?: EscopoDaAlteracao;
      ocorrencia?: string;
    }) => {
      const params = new URLSearchParams();
      if (escopo) params.set("escopo", escopo);
      if (ocorrencia) params.set("ocorrencia", ocorrencia);
      const query = params.toString();
      return del(`/api/agenda/${eventId}${query ? `?${query}` : ""}`);
    },
    onSuccess: invalidar,
  });
}

export function useResponderReuniao() {
  const invalidar = useInvalidarAgenda();
  return useMutation({
    mutationFn: ({
      eventId,
      resposta,
    }: {
      eventId: string;
      resposta: RespostaDeParticipante;
    }) => post(`/api/agenda/${eventId}/resposta`, { resposta }),
    onSuccess: invalidar,
  });
}
