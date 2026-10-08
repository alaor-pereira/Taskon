"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/messages";
import { useMoverProjeto } from "@/lib/queries/projects";
import type { Projeto, StatusTarefa } from "@/lib/types";
import { cn } from "@/lib/utils";
import { colisaoDoKanban, PREFIXO_COLUNA } from "@/components/kanban/colisao";
import { CabecalhoDaColuna } from "@/components/tasks/task-kanban";
import {
  podeEditarProjeto,
  podeExcluirProjeto,
  ProjectCard,
  useMeuId,
} from "./project-card";

/** As mesmas seis etapas do kanban de tarefas. */
const COLUNAS: StatusTarefa[] = [
  "BACKLOG",
  "A_FAZER",
  "EM_ANDAMENTO",
  "EM_REVISAO",
  "EM_PAUSA",
  "CONCLUIDO",
];

/**
 * Kanban de projetos: a etapa é um campo simples do projeto, sem posição
 * dentro da coluna — arrastar só muda de coluna, não reordena.
 */
export function ProjectKanban({
  projetos,
  onAbrirProjeto,
  onEditarProjeto,
  onExcluirProjeto,
  etapaAceita,
}: {
  projetos: Projeto[];
  onAbrirProjeto: (projeto: Projeto) => void;
  onEditarProjeto?: (projeto: Projeto) => void;
  onExcluirProjeto?: (projeto: Projeto) => void;
  /**
   * Filtro de etapa ativo na página. As colunas de fora continuam na tela,
   * apagadas: sem cartões, sem "+" e sem aceitar cartão arrastado — um
   * cartão solto ali sumiria da tela na hora, parecendo perdido.
   */
  etapaAceita?: (status: StatusTarefa) => boolean;
}) {
  const meuId = useMeuId();
  const [arrastando, setArrastando] = useState<Projeto | null>(null);
  /** Coluna sob o cursor; a de origem não conta, porque aqui não se reordena. */
  const [colunaSobre, setColunaSobre] = useState<StatusTarefa | null>(null);
  const mover = useMoverProjeto();

  const porColuna = useMemo(() => {
    const mapa = new Map<StatusTarefa, Projeto[]>();
    for (const coluna of COLUNAS) mapa.set(coluna, []);
    for (const projeto of projetos) mapa.get(projeto.status)?.push(projeto);
    return mapa;
  }, [projetos]);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function aoIniciar(evento: DragStartEvent) {
    const projeto = projetos.find((p) => p.id === evento.active.id);
    setArrastando(projeto ?? null);
  }

  function aoPassar({ over }: DragOverEvent) {
    const alvo = over && String(over.id).startsWith(PREFIXO_COLUNA)
      ? (String(over.id).slice(PREFIXO_COLUNA.length) as StatusTarefa)
      : null;
    setColunaSobre(alvo && alvo !== arrastando?.status ? alvo : null);
  }

  function limpar() {
    setArrastando(null);
    setColunaSobre(null);
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={colisaoDoKanban}
      onDragStart={aoIniciar}
      onDragOver={aoPassar}
      onDragEnd={(evento) => aoSoltar(evento, projetos, limpar, mover)}
      onDragCancel={limpar}
    >
      <div className="flex h-full min-h-80 gap-3 overflow-x-auto pb-2 md:overflow-x-visible">
        {COLUNAS.map((status) => (
          <Coluna
            key={status}
            status={status}
            projetos={porColuna.get(status) ?? []}
            onAbrirProjeto={onAbrirProjeto}
            editar={(projeto) =>
              onEditarProjeto && podeEditarProjeto(projeto, meuId)
                ? () => onEditarProjeto(projeto)
                : undefined
            }
            excluir={(projeto) =>
              onExcluirProjeto && podeExcluirProjeto(projeto, meuId)
                ? () => onExcluirProjeto(projeto)
                : undefined
            }
            inativa={etapaAceita ? !etapaAceita(status) : false}
            destacada={colunaSobre === status}
          />
        ))}
      </div>

      <DragOverlay>
        {arrastando && (
          <ProjectCard
            projeto={arrastando}
            onIrPara={() => {}}
            onEditar={
              onEditarProjeto && podeEditarProjeto(arrastando, meuId) ? () => {} : undefined
            }
            onExcluir={
              onExcluirProjeto && podeExcluirProjeto(arrastando, meuId) ? () => {} : undefined
            }
            arrastavel
            irParaNoRodape
            className="cursor-grabbing ring-2 ring-ring"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

async function aoSoltar(
  evento: DragEndEvent,
  projetos: Projeto[],
  limpar: () => void,
  mover: ReturnType<typeof useMoverProjeto>,
) {
  limpar();
  const { active, over } = evento;
  if (!over) return;

  const arrastado = projetos.find((p) => p.id === active.id);
  if (!arrastado) return;
  if (!String(over.id).startsWith(PREFIXO_COLUNA)) return;

  const destino = String(over.id).slice(PREFIXO_COLUNA.length) as StatusTarefa;
  if (destino === arrastado.status) return;

  try {
    await mover.mutateAsync({ projectId: arrastado.id, status: destino });
  } catch (erro) {
    toast.error(erro instanceof ApiError ? erro.message : t.erros.generico);
  }
}

function Coluna({
  status,
  projetos,
  onAbrirProjeto,
  editar,
  excluir,
  inativa,
  destacada,
}: {
  status: StatusTarefa;
  projetos: Projeto[];
  onAbrirProjeto: (projeto: Projeto) => void;
  /** Devolve a ação de editar, ou nada quando o usuário não pode. */
  editar: (projeto: Projeto) => (() => void) | undefined;
  /** Devolve a ação de excluir, ou nada quando o usuário não pode. */
  excluir: (projeto: Projeto) => (() => void) | undefined;
  inativa: boolean;
  /** O cartão arrastado cairia aqui. */
  destacada: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: `${PREFIXO_COLUNA}${status}`,
    disabled: inativa,
  });

  return (
    <section
      ref={setNodeRef}
      aria-label={inativa ? `${t.status[status]} (fora do filtro)` : t.status[status]}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 transition-[background-color,border-color,opacity] md:w-0 md:min-w-0 md:flex-1",
        destacada && !inativa && "border-ring/50 bg-accent/40",
        inativa && "opacity-40",
      )}
    >
      <CabecalhoDaColuna status={status} quantidade={projetos.length} />

      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-2 pb-2">
        {projetos.map((projeto) => (
          <CartaoArrastavel
            key={projeto.id}
            projeto={projeto}
            onAbrir={() => onAbrirProjeto(projeto)}
            onEditar={editar(projeto)}
            onExcluir={excluir(projeto)}
          />
        ))}

        {projetos.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">Vazio</p>
        )}
      </div>
    </section>
  );
}

function CartaoArrastavel({
  projeto,
  onAbrir,
  onEditar,
  onExcluir,
}: {
  projeto: Projeto;
  onAbrir: () => void;
  onEditar?: () => void;
  onExcluir?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: projeto.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      // O dnd-kit marca o invólucro com role="button", que a base do CSS
      // pinta com a mãozinha; aqui o gesto é arrastar.
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <ProjectCard
        projeto={projeto}
        onIrPara={onAbrir}
        onEditar={onEditar}
        onExcluir={onExcluir}
        arrastavel
        irParaNoRodape
      />
    </div>
  );
}
