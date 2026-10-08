"use client";

import {
  Calendar03Icon,
  PencilEdit02Icon,
  PlusSignIcon,
  SquareArrowUpRightIcon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useExcluirTarefaComConfirmacao } from "@/components/confirmar-exclusao";
import { useAbas } from "@/components/tabs/tabs-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import { Separator } from "@/components/ui/separator";
import { ApiError } from "@/lib/api";
import { dataCurta } from "@/lib/datas";
import { t } from "@/lib/messages";
import { useVisualizacao } from "@/lib/queries/preferences";
import { useProjeto } from "@/lib/queries/projects";
import { useTarefa } from "@/lib/queries/tasks";
import { cn } from "@/lib/utils";
import { abrirProjetoEm, abrirTarefaEm } from "@/components/layout/areas/abrir";
import { SeletorVisualizacao, UltimaAlteracao } from "@/components/layout/controles-da-pagina";
import { CommentSection } from "@/components/comments/comment-section";
import { DifficultyBadge, PriorityBadge, Responsaveis, StatusBadge } from "./task-badges";
import { estaAtrasada } from "./task-card";
import { TaskDialog } from "./task-dialog";
import { TaskCards, TaskList } from "./task-list";
import { TaskKanban } from "./task-kanban";

/**
 * Página de uma tarefa, aberta como aba.
 *
 * As subtarefas aparecem na visualização escolhida para esta tarefa — o prompt
 * pede que Cards, Kanban e Lista valem tanto para projetos quanto para tarefas.
 */
export function TaskView({ taskId }: { taskId: string }) {
  const { data: tarefa, isPending, error } = useTarefa(taskId);
  const { data: projeto } = useProjeto(tarefa?.projectId ?? null);
  const { visualizacao } = useVisualizacao("TAREFA", taskId, "LISTA");
  const { abrirAba } = useAbas();

  const [editando, setEditando] = useState(false);
  const [criandoSubtarefa, setCriandoSubtarefa] = useState(false);
  const [subtarefaAberta, setSubtarefaAberta] = useState<string | null>(null);
  const exclusao = useExcluirTarefaComConfirmacao({ projectId: tarefa?.projectId });

  if (isPending) return <Carregando />;

  if (error || !tarefa) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <p className="heading-section">Tarefa indisponível</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof ApiError ? error.message : t.erros.generico}
          </p>
        </div>
      </div>
    );
  }

  const podeEditar =
    projeto?.meuPapel === "OWNER" || projeto?.meuPapel === "EDITOR";
  const atrasada = estaAtrasada(tarefa);

  return (
    // Em tela larga, duas colunas com rolagem própria: a tarefa à esquerda e a
    // conversa à direita, sempre à vista. Em tela estreita, tudo empilha e
    // rola junto.
    <div className="h-full overflow-y-auto lg:flex lg:overflow-hidden">
      <div className="flex min-w-0 flex-col lg:h-full lg:flex-1">
        <header className="shrink-0 space-y-3 px-6 pt-5 pb-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {projeto && (
              <button
                type="button"
                onClick={() => abrirProjetoEm(abrirAba, projeto.projeto)}
                className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
              >
                {projeto.projeto.name}
                <Icone icon={SquareArrowUpRightIcon} className="size-4" />
              </button>
            )}
            {tarefa.parent && <span>· subtarefa de “{tarefa.parent.title}”</span>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1
              className={cn(
                "min-w-0 flex-1 text-lg font-semibold tracking-tight",
                tarefa.status === "CONCLUIDO" && "text-muted-foreground line-through",
              )}
            >
              {tarefa.title}
            </h1>

            <UltimaAlteracao
              autor={tarefa.updatedBy}
              alteradoEm={tarefa.updatedAt}
              criadoEm={tarefa.createdAt}
            />

            {/* Subtarefa não tem subtarefas: não há o que visualizar. */}
            {!tarefa.parentId && (
              <SeletorVisualizacao tipo="TAREFA" recursoId={taskId} padrao="LISTA" />
            )}

            {podeEditar && (
              <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
                <Icone icon={PencilEdit02Icon} />
                Editar
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={tarefa.status} />
            <PriorityBadge priority={tarefa.priority} />
            <DifficultyBadge difficulty={tarefa.difficulty} />

            {tarefa.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  atrasada ? "font-semibold text-destructive" : "text-muted-foreground",
                )}
              >
                <Icone icon={Calendar03Icon} className="size-4" />
                {dataCurta(tarefa.dueDate)}
                {atrasada && " · atrasada"}
              </span>
            )}

            {tarefa.assignees.length > 0 && (
              <Responsaveis usuarios={tarefa.assignees.map((a) => a.user)} max={5} />
            )}
          </div>

          {tarefa.description && (
            <p className="text-sm leading-relaxed wrap-break-word whitespace-pre-wrap text-muted-foreground">
              {tarefa.description}
            </p>
          )}
        </header>

        <Separator />

        <div
          className={cn(
            "min-h-0 flex-1 px-6 py-4 lg:flex lg:flex-col lg:overflow-y-auto",
            // Numa subtarefa o corpo fica vazio; no celular não ocupa espaço.
            tarefa.parentId && "max-lg:hidden",
          )}
        >
          {/* Subtarefas têm um nível só: numa subtarefa, o bloco não existe. */}
          {!tarefa.parentId && (
            <div className="mb-3 flex items-center gap-2">
              <h2 className="heading-section">Subtarefas</h2>
              <Badge variant="secondary">{tarefa.subtasks.length}</Badge>
              {podeEditar && (
                <Button
                  size="xs"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setCriandoSubtarefa(true)}
                >
                  <Icone icon={PlusSignIcon} />
                  Nova subtarefa
                </Button>
              )}
            </div>
          )}

          {tarefa.parentId ? null : visualizacao === "KANBAN" ? (
            // As colunas ocupam a altura que sobra: o espaço vazio delas
            // também aceita o cartão arrastado.
            <div className="lg:min-h-0 lg:flex-1">
              <TaskKanban
                tarefas={tarefa.subtasks}
                podeEditar={Boolean(podeEditar)}
                onAbrirTarefa={(sub) => abrirTarefaEm(abrirAba, sub)}
                onEditarTarefa={(sub) => setSubtarefaAberta(sub.id)}
                onExcluirTarefa={exclusao.pedir}
                onNovaTarefa={() => setCriandoSubtarefa(true)}
              />
            </div>
          ) : visualizacao === "CARDS" ? (
            <TaskCards
              tarefas={tarefa.subtasks}
              onAbrirTarefa={(sub) => abrirTarefaEm(abrirAba, sub)}
              onEditarTarefa={podeEditar ? (sub) => setSubtarefaAberta(sub.id) : undefined}
              onExcluirTarefa={podeEditar ? exclusao.pedir : undefined}
              vazio={t.vazio.semSubtarefas}
            />
          ) : (
            <TaskList
              tarefas={tarefa.subtasks}
              onAbrirTarefa={(sub) => abrirTarefaEm(abrirAba, sub)}
              onEditarTarefa={podeEditar ? (sub) => setSubtarefaAberta(sub.id) : undefined}
              onExcluirTarefa={podeEditar ? exclusao.pedir : undefined}
              vazio={t.vazio.semSubtarefas}
            />
          )}
          {exclusao.dialogo}
        </div>
      </div>

      <aside className="border-t lg:flex lg:h-full lg:w-90 lg:shrink-0 lg:flex-col lg:border-t-0 lg:border-l">
        <CommentSection
          taskId={taskId}
          meuPapel={projeto?.meuPapel}
          ownerId={projeto?.projeto.ownerId}
        />
      </aside>

      <TaskDialog
        aberto={editando}
        aoFechar={() => setEditando(false)}
        taskId={taskId}
        projectId={tarefa.projectId}
        membros={projeto?.membros}
        podeEditar={podeEditar}
      />

      <TaskDialog
        aberto={criandoSubtarefa}
        aoFechar={() => setCriandoSubtarefa(false)}
        projectId={tarefa.projectId}
        parentId={taskId}
        membros={projeto?.membros}
      />

      <TaskDialog
        aberto={Boolean(subtarefaAberta)}
        aoFechar={() => setSubtarefaAberta(null)}
        taskId={subtarefaAberta}
        projectId={tarefa.projectId}
        membros={projeto?.membros}
        podeEditar={podeEditar}
      />
    </div>
  );
}

function Carregando() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="h-6 w-72 animate-pulse rounded bg-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
