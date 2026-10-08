"use client";

import { format } from "date-fns";
import { TrafficLightIcon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/messages";
import type { Dificuldade, Prioridade, StatusTarefa, UsuarioResumo } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Marcadores visuais de status, prioridade, dificuldade e responsáveis.
 *
 * Cor sozinha não comunica: cada marcador traz o texto do estado, para que a
 * informação continue legível por quem não distingue as cores.
 */

const CORES_DE_STATUS: Record<StatusTarefa, string> = {
  BACKLOG: "bg-muted text-muted-foreground",
  A_FAZER: "bg-status-todo text-status-todo-foreground",
  EM_ANDAMENTO: "bg-status-in-progress text-status-in-progress-foreground",
  EM_REVISAO: "bg-status-review text-status-review-foreground",
  EM_PAUSA: "bg-status-paused text-status-paused-foreground",
  CONCLUIDO: "bg-status-done text-status-done-foreground",
};

export function StatusBadge({
  status,
  className,
}: {
  status: StatusTarefa;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        CORES_DE_STATUS[status],
        className,
      )}
    >
      {t.status[status]}
    </span>
  );
}

/** Cor sólida de cada etapa, para o ponto do cartão. */
const PONTO_DE_STATUS: Record<StatusTarefa, string> = {
  BACKLOG: "bg-muted-foreground",
  A_FAZER: "bg-status-todo-foreground",
  EM_ANDAMENTO: "bg-status-in-progress-foreground",
  EM_REVISAO: "bg-status-review-foreground",
  EM_PAUSA: "bg-status-paused-foreground",
  CONCLUIDO: "bg-status-done-foreground",
};

/**
 * Ponto colorido da etapa, ao lado do título do cartão. Mantém a etapa
 * identificável quando o cartão sai da coluna (arrastando) ou do grupo. O
 * texto vai para leitores de tela: a cor sozinha não comunica.
 */
export function StatusDot({ status }: { status: StatusTarefa }) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", PONTO_DE_STATUS[status])}
      title={t.status[status]}
    >
      <span className="sr-only">{t.status[status]}</span>
    </span>
  );
}

/** Fundo e texto da etapa — a faixa do cabeçalho da coluna do Kanban. */
export function corDaEtapa(status: StatusTarefa) {
  return CORES_DE_STATUS[status];
}

/**
 * Título da coluna do Kanban: nome e contagem. A cor vem da faixa do
 * cabeçalho (`corDaEtapa`), não de uma pílula própria.
 */
export function StatusCabecalho({
  status,
  quantidade,
}: {
  status: StatusTarefa;
  quantidade: number;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-sm font-semibold">
      {t.status[status]}
      <span className="text-xs tabular-nums opacity-80">{quantidade}</span>
    </span>
  );
}

const CORES_DE_PRIORIDADE: Record<Prioridade, string> = {
  ALTA: "text-priority-high",
  MEDIA: "text-priority-medium",
  BAIXA: "text-priority-low",
};

/**
 * Prioridade como semáforo: vermelho (Alta), âmbar (Média), verde (Baixa).
 * `compacto` mostra só o ícone — o nome fica na dica e no leitor de tela.
 */
export function PriorityBadge({
  priority,
  compacto = false,
  className,
}: {
  priority: Prioridade;
  compacto?: boolean;
  className?: string;
}) {
  const rotulo = `Prioridade ${t.prioridade[priority].toLowerCase()}`;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold",
        CORES_DE_PRIORIDADE[priority],
        className,
      )}
      title={compacto ? rotulo : undefined}
    >
      <Icone icon={TrafficLightIcon} className="size-4" aria-hidden />
      {compacto ? <span className="sr-only">{rotulo}</span> : t.prioridade[priority]}
    </span>
  );
}

/**
 * Dificuldade estimada: as três barras (1, 2 ou 3 cheias), em cinza — o
 * semáforo da prioridade é a única cor do cartão. Sem estimativa, nada
 * aparece, a não ser que `mostrarVazio` peça o texto "Não estimada".
 */
export function DifficultyBadge({
  difficulty,
  compacto = false,
  mostrarVazio = false,
  className,
}: {
  difficulty: Dificuldade | null;
  compacto?: boolean;
  mostrarVazio?: boolean;
  className?: string;
}) {
  if (!difficulty) {
    return mostrarVazio ? (
      <span className={cn("shrink-0 text-[11px] text-muted-foreground", className)}>
        {t.dificuldade.naoEstimada}
      </span>
    ) : null;
  }

  const rotulo = `Dificuldade: ${t.dificuldade[difficulty]}`;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground",
        className,
      )}
      title={compacto ? rotulo : undefined}
    >
      <BarrasDeDificuldade difficulty={difficulty} />
      {compacto ? <span className="sr-only">{rotulo}</span> : t.dificuldade[difficulty]}
    </span>
  );
}

/** Três barras, com as preenchidas indicando o nível. */
function BarrasDeDificuldade({ difficulty }: { difficulty: Dificuldade }) {
  const preenchidas = difficulty === "CRITICO" ? 3 : difficulty === "COMPLEXO" ? 2 : 1;
  return (
    <span aria-hidden className="inline-flex items-end gap-px">
      {[4, 7, 10].map((altura, i) => (
        <span
          key={altura}
          className={cn("w-[3px] rounded-[1px]", i < preenchidas ? "bg-current" : "bg-current/25")}
          style={{ height: altura }}
        />
      ))}
    </span>
  );
}

/** Valor do Select para "Não estimada": o Select não aceita null como item. */
export const SEM_DIFICULDADE = "NENHUMA";

/**
 * Rótulos dos selects de prioridade e dificuldade (prop `items` do Select):
 * sem eles, o gatilho mostraria o valor cru ("ALTA", "NENHUMA").
 */
export const ITENS_DE_PRIORIDADE: Record<string, ReactNode> = {
  ALTA: <PriorityBadge priority="ALTA" />,
  MEDIA: <PriorityBadge priority="MEDIA" />,
  BAIXA: <PriorityBadge priority="BAIXA" />,
};

export const ITENS_DE_DIFICULDADE: Record<string, ReactNode> = {
  [SEM_DIFICULDADE]: t.dificuldade.naoEstimada,
  ROTINEIRO: <DifficultyBadge difficulty="ROTINEIRO" />,
  COMPLEXO: <DifficultyBadge difficulty="COMPLEXO" />,
  CRITICO: <DifficultyBadge difficulty="CRITICO" />,
};

/**
 * Prazo vencido só vale para trabalho ativo (A fazer, Em andamento, Em
 * revisão), em tarefas e em projetos. Compara datas puras no dia local:
 * `toISOString()` daria o dia em UTC, que já virou amanhã à noite no Brasil.
 */
export function prazoVencido(status: StatusTarefa, dueDate: string | null): boolean {
  if (!dueDate) return false;
  if (!["A_FAZER", "EM_ANDAMENTO", "EM_REVISAO"].includes(status)) return false;
  return dueDate.slice(0, 10) < format(new Date(), "yyyy-MM-dd");
}

export function Responsaveis({
  usuarios,
  max = 3,
  tamanho = "sm",
}: {
  usuarios: UsuarioResumo[];
  max?: number;
  tamanho?: "sm" | "md";
}) {
  if (usuarios.length === 0) return null;

  const visiveis = usuarios.slice(0, max);
  const restantes = usuarios.length - visiveis.length;
  const medida = tamanho === "md" ? "size-6 text-[10px]" : "size-5 text-[9px]";

  return (
    <span className="flex shrink-0 items-center -space-x-1.5">
      {visiveis.map((u) => (
        <Avatar key={u.id} className={cn(medida, "ring-2 ring-card")} title={u.name}>
          {u.image && <AvatarImage src={u.image} alt="" />}
          <AvatarFallback className={medida}>{iniciais(u.name)}</AvatarFallback>
        </Avatar>
      ))}
      {restantes > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted font-semibold ring-2 ring-card",
            medida,
          )}
          title={usuarios
            .slice(max)
            .map((u) => u.name)
            .join(", ")}
        >
          +{restantes}
        </span>
      )}
    </span>
  );
}

export function iniciais(nome: string): string {
  return (
    nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
