import type { Dificuldade, Prioridade, StatusTarefa } from "@/lib/types";

/**
 * Cores dos gráficos do Dashboard. Os valores ficam em `globals.css`
 * (`--etapa-*`, `--prioridade-*`, `--dificuldade-*`, `--serie-*`), um conjunto
 * por tema, todos conferidos pelo validador de paletas. Aqui só se escolhe
 * qual variável cada categoria usa — a cor segue a categoria, nunca a posição.
 */

export const COR_DA_ETAPA: Record<StatusTarefa, string> = {
  BACKLOG: "var(--etapa-backlog)",
  A_FAZER: "var(--etapa-a-fazer)",
  EM_ANDAMENTO: "var(--etapa-em-andamento)",
  EM_REVISAO: "var(--etapa-em-revisao)",
  EM_PAUSA: "var(--etapa-em-pausa)",
  CONCLUIDO: "var(--etapa-concluido)",
};

export const COR_DA_PRIORIDADE: Record<Prioridade, string> = {
  ALTA: "var(--prioridade-alta)",
  MEDIA: "var(--prioridade-media)",
  BAIXA: "var(--prioridade-baixa)",
};

export const COR_DA_DIFICULDADE: Record<Dificuldade | "NAO_ESTIMADA", string> = {
  ROTINEIRO: "var(--dificuldade-1)",
  COMPLEXO: "var(--dificuldade-2)",
  CRITICO: "var(--dificuldade-3)",
  NAO_ESTIMADA: "var(--dificuldade-nao-estimada)",
};

/**
 * Séries categóricas, na ordem fixa. Só três: são as únicas que se distinguem
 * duas a duas, com daltonismo, nos dois temas.
 */
export const SERIES = ["var(--serie-1)", "var(--serie-2)", "var(--serie-3)"] as const;

/** Rampa do mapa de calor: do passo mais fraco ao mais forte, por tema. */
export const RAMPA_DE_INTENSIDADE = [
  "var(--viz-2)",
  "var(--viz-3)",
  "var(--viz-4)",
  "var(--viz-5)",
  "var(--viz-6)",
] as const;
