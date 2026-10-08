"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { colisaoDoKanban, PREFIXO_COLUNA } from "@/components/kanban/colisao";
import { Icone } from "@/components/ui/icone";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/messages";
import { useMoverTarefa } from "@/lib/queries/tasks";
import type { StatusTarefa, Tarefa } from "@/lib/types";
import { cn } from "@/lib/utils";
import { corDaEtapa, StatusCabecalho } from "./task-badges";
import { TaskCard } from "./task-card";

/** As seis etapas, na ordem em que o trabalho costuma andar. */
const COLUNAS: StatusTarefa[] = [
  "BACKLOG",
  "A_FAZER",
  "EM_ANDAMENTO",
  "EM_REVISAO",
  "EM_PAUSA",
  "CONCLUIDO",
];

/**
 * Kanban.
 *
 * A ordem é persistida: o servidor calcula a posição a partir de "antes de qual
 * tarefa", e não de um número enviado pelo cliente. Assim dois arrastos
 * simultâneos não gravam a mesma posição.
 *
 * Subtarefas não viram cartões soltos — elas aparecem dentro do cartão do pai,
 * como contagem.
 */
export function TaskKanban({
  tarefas,
  podeEditar,
  onAbrirTarefa,
  onEditarTarefa,
  onExcluirTarefa,
  onNovaTarefa,
  etapaAceita,
}: {
  tarefas: Tarefa[];
  podeEditar: boolean;
  /** "Ir para": abre a tarefa numa aba (a seta do rodapé). */
  onAbrirTarefa: (tarefa: Tarefa) => void;
  /** Edição rápida. Só aparece quando `podeEditar`. */
  onEditarTarefa?: (tarefa: Tarefa) => void;
  /** Envia para a Lixeira. Só aparece quando `podeEditar`. */
  onExcluirTarefa?: (tarefa: Tarefa) => void;
  onNovaTarefa: (status: StatusTarefa) => void;
  /**
   * Filtro de etapa ativo na página. As colunas de fora continuam na tela,
   * apagadas: sem cartões, sem "+" e sem aceitar cartão arrastado — um
   * cartão solto ali sumiria da tela na hora, parecendo perdido.
   */
  etapaAceita?: (status: StatusTarefa) => boolean;
}) {
  const mover = useMoverTarefa();
  const [arrastando, setArrastando] = useState<Tarefa | null>(null);
  /**
   * Coluna sob o cursor durante o arrasto. Não dá para usar o `isOver` da
   * própria coluna: sobre um cartão, o alvo é o cartão, e a coluna perderia
   * o destaque justamente onde o cartão vai cair.
   */
  const [colunaSobre, setColunaSobre] = useState<StatusTarefa | null>(null);

  const porColuna = useMemo(() => {
    const mapa = new Map<StatusTarefa, Tarefa[]>();
    for (const coluna of COLUNAS) mapa.set(coluna, []);
    for (const tarefa of tarefas) mapa.get(tarefa.status)?.push(tarefa);
    for (const lista of mapa.values()) lista.sort((a, b) => a.position - b.position);
    return mapa;
  }, [tarefas]);

  const sensores = useSensors(
    // A distância mínima evita que um clique para abrir a tarefa seja
    // interpretado como início de arrasto.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function aoIniciar(evento: DragStartEvent) {
    const tarefa = tarefas.find((t) => t.id === evento.active.id);
    setArrastando(tarefa ?? null);
  }

  function aoPassar(evento: DragOverEvent) {
    setColunaSobre(evento.over ? statusDoAlvo(String(evento.over.id), tarefas) : null);
  }

  function limpar() {
    setArrastando(null);
    setColunaSobre(null);
  }

  async function aoSoltar(evento: DragEndEvent) {
    limpar();
    const { active, over } = evento;
    if (!over) return;

    const arrastada = tarefas.find((t) => t.id === active.id);
    if (!arrastada) return;

    const destino = statusDoAlvo(String(over.id), tarefas);
    if (!destino) return;

    const antesDeId = calcularAntesDe(
      arrastada,
      String(over.id),
      destino,
      porColuna.get(destino) ?? [],
    );

    // Soltar no mesmo lugar não precisa de requisição.
    if (destino === arrastada.status && antesDeId === undefined) return;

    try {
      await mover.mutateAsync({
        taskId: arrastada.id,
        status: destino,
        antesDeId: antesDeId ?? null,
      });
    } catch (erro) {
      toast.error(erro instanceof ApiError ? erro.message : t.erros.generico);
    }
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={colisaoDoKanban}
      onDragStart={aoIniciar}
      onDragOver={aoPassar}
      onDragEnd={aoSoltar}
      onDragCancel={limpar}
    >
      <div className="flex h-full min-h-80 gap-3 overflow-x-auto pb-2 md:overflow-x-visible">
        {COLUNAS.map((status) => (
          <Coluna
            key={status}
            status={status}
            tarefas={porColuna.get(status) ?? []}
            podeEditar={podeEditar}
            onAbrirTarefa={onAbrirTarefa}
            onEditarTarefa={podeEditar ? onEditarTarefa : undefined}
            onExcluirTarefa={podeEditar ? onExcluirTarefa : undefined}
            onNovaTarefa={onNovaTarefa}
            inativa={etapaAceita ? !etapaAceita(status) : false}
            destacada={colunaSobre === status}
          />
        ))}
      </div>

      {/* A prévia acompanha o cursor sem arrastar o cartão original. */}
      <DragOverlay>
        {arrastando && (
          <TaskCard
            tarefa={arrastando}
            onIrPara={() => {}}
            onEditar={podeEditar && onEditarTarefa ? () => {} : undefined}
            onExcluir={podeEditar && onExcluirTarefa ? () => {} : undefined}
            arrastavel
            irParaNoRodape
            className="cursor-grabbing ring-2 ring-ring"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Coluna({
  status,
  tarefas,
  podeEditar,
  onAbrirTarefa,
  onEditarTarefa,
  onExcluirTarefa,
  onNovaTarefa,
  inativa,
  destacada,
}: {
  status: StatusTarefa;
  tarefas: Tarefa[];
  podeEditar: boolean;
  onAbrirTarefa: (tarefa: Tarefa) => void;
  onEditarTarefa?: (tarefa: Tarefa) => void;
  onExcluirTarefa?: (tarefa: Tarefa) => void;
  onNovaTarefa: (status: StatusTarefa) => void;
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
      <CabecalhoDaColuna status={status} quantidade={tarefas.length}>
        {podeEditar && !inativa && (
          <button
            type="button"
            onClick={() => onNovaTarefa(status)}
            aria-label={`Nova tarefa em ${t.status[status]}`}
            className="ml-auto inline-flex size-5 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100"
          >
            <Icone icon={PlusSignIcon} className="size-4" />
          </button>
        )}
      </CabecalhoDaColuna>

      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-2 pb-2">
        <SortableContext
          items={tarefas.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tarefas.map((tarefa) => (
            <CartaoArrastavel
              key={tarefa.id}
              tarefa={tarefa}
              podeEditar={podeEditar}
              onAbrir={() => onAbrirTarefa(tarefa)}
              onEditar={onEditarTarefa ? () => onEditarTarefa(tarefa) : undefined}
              onExcluir={onExcluirTarefa ? () => onExcluirTarefa(tarefa) : undefined}
            />
          ))}
        </SortableContext>

        {tarefas.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Vazio
          </p>
        )}
      </div>
    </section>
  );
}

function CartaoArrastavel({
  tarefa,
  podeEditar,
  onAbrir,
  onEditar,
  onExcluir,
}: {
  tarefa: Tarefa;
  podeEditar: boolean;
  onAbrir: () => void;
  onEditar?: () => void;
  onExcluir?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: tarefa.id,
      disabled: !podeEditar,
      data: { status: tarefa.status },
    });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // O dnd-kit marca o invólucro com role="button", que a base do CSS
      // pinta com a mãozinha; aqui o gesto é arrastar.
      className={cn(
        podeEditar ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
    >
      <TaskCard
        tarefa={tarefa}
        onIrPara={onAbrir}
        onEditar={onEditar}
        onExcluir={onExcluir}
        arrastavel={podeEditar}
        irParaNoRodape
      />
    </div>
  );
}

/**
 * Cabeçalho da coluna: uma faixa na cor da etapa, de ponta a ponta, com os
 * cantos de cima acompanhando a borda da coluna. `children` vai à direita
 * (o "+" do Kanban de tarefas) e herda a cor da faixa.
 */
export function CabecalhoDaColuna({
  status,
  quantidade,
  children,
}: {
  status: StatusTarefa;
  quantidade: number;
  children?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "flex items-center gap-2 rounded-t-[calc(var(--radius-lg)-1px)] px-3 py-2.5",
        corDaEtapa(status),
      )}
    >
      <h3>
        <StatusCabecalho status={status} quantidade={quantidade} />
      </h3>
      {children}
    </header>
  );
}

// --- Cálculo do destino ----------------------------------------------------

/** O alvo pode ser a coluna vazia ou outro cartão. */
function statusDoAlvo(overId: string, tarefas: Tarefa[]): StatusTarefa | null {
  if (overId.startsWith(PREFIXO_COLUNA)) {
    return overId.slice(PREFIXO_COLUNA.length) as StatusTarefa;
  }
  return tarefas.find((t) => t.id === overId)?.status ?? null;
}

/**
 * Traduz "soltei sobre este cartão" em "insira antes de qual tarefa".
 *
 * Numa lista vertical, arrastar A sobre B significa que A toma o lugar de B:
 * se A vinha de cima, termina depois de B; se vinha de baixo, termina antes.
 * Devolve `undefined` quando nada muda, e `null` para o fim da coluna.
 */
function calcularAntesDe(
  arrastada: Tarefa,
  overId: string,
  destino: StatusTarefa,
  colunaDestino: Tarefa[],
): string | null | undefined {
  if (overId.startsWith(PREFIXO_COLUNA)) return null;
  // Solta sobre o próprio lugar de origem: nada muda.
  if (overId === arrastada.id) return undefined;

  const semArrastada = colunaDestino.filter((t) => t.id !== arrastada.id);
  const indiceAlvo = semArrastada.findIndex((t) => t.id === overId);
  if (indiceAlvo === -1) return null;

  const mesmaColuna = arrastada.status === destino;
  const indiceOrigem = colunaDestino.findIndex((t) => t.id === arrastada.id);
  const indiceAlvoOriginal = colunaDestino.findIndex((t) => t.id === overId);

  if (mesmaColuna && indiceOrigem === indiceAlvoOriginal) return undefined;

  const vindoDeCima = mesmaColuna && indiceOrigem < indiceAlvoOriginal;
  if (vindoDeCima) {
    // Termina depois do alvo, ou seja, antes de quem vem logo após ele.
    return semArrastada[indiceAlvo + 1]?.id ?? null;
  }
  return overId;
}
