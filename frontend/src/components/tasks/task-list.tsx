"use client";

import {
  Calendar03Icon,
  Delete02Icon,
  HierarchyIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { BotaoDeIcone } from "@/components/cards/botao-de-icone";
import { GradeDeCards, porAlteracaoRecente } from "@/components/cards/grade-de-cards";
import { Icone } from "@/components/ui/icone";
import { dataCurta } from "@/lib/datas";
import type { Tarefa } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DifficultyBadge, PriorityBadge, Responsaveis, StatusBadge } from "./task-badges";
import { estaAtrasada, TaskCard, TaskCardVazio } from "./task-card";

/**
 * Coluna de largura fixa da visualização Lista. Ela existe em toda linha,
 * mesmo vazia: assim uma tarefa com responsáveis ou subtarefas não empurra as
 * colunas vizinhas, e tudo fica alinhado de uma linha para a outra. Só o
 * título é flexível.
 */
export function ColunaDaLista({
  largura,
  alinhar = "inicio",
  children,
}: {
  /** Classe de largura do Tailwind, por exemplo "w-24". */
  largura: string;
  alinhar?: "inicio" | "fim";
  children?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center",
        largura,
        alinhar === "fim" && "justify-end",
      )}
    >
      {children}
    </span>
  );
}

/** Linha da Lista: o fundo reage ao hover da linha inteira. */
export const LINHA_DA_LISTA =
  "relative flex w-full items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40";

/**
 * Título da linha: é o botão que abre o item, esticado sobre a linha toda
 * (`after:inset-0`), como no cartão. As ações à direita ficam acima dele.
 */
export const TITULO_DA_LINHA =
  "min-w-0 flex-1 truncate text-left text-sm outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-solid focus-visible:after:outline-ring";

/**
 * Editar e Excluir no fim da linha, sempre à vista. A coluna existe mesmo
 * quando o usuário não pode uma das ações, para manter o alinhamento.
 */
export function AcoesDaLinha({
  rotuloEditar,
  rotuloExcluir,
  onEditar,
  onExcluir,
}: {
  rotuloEditar: string;
  rotuloExcluir: string;
  onEditar?: () => void;
  onExcluir?: () => void;
}) {
  return (
    <ColunaDaLista largura="w-16" alinhar="fim">
      {/* -my-1: os botões não esticam a altura da linha. */}
      <span className="relative z-10 -my-1 flex items-center gap-0.5">
        {onEditar && (
          <BotaoDeIcone rotulo={rotuloEditar} onClick={onEditar}>
            <Icone icon={PencilEdit02Icon} className="size-4" />
          </BotaoDeIcone>
        )}
        {onExcluir && (
          <BotaoDeIcone rotulo={rotuloExcluir} onClick={onExcluir} destrutivo>
            <Icone icon={Delete02Icon} className="size-4" />
          </BotaoDeIcone>
        )}
      </span>
    </ColunaDaLista>
  );
}

/** Visualização em Lista: densa, para varrer muitas tarefas de uma vez. */
export function TaskList({
  tarefas,
  onAbrirTarefa,
  onEditarTarefa,
  onExcluirTarefa,
  vazio,
}: {
  tarefas: Tarefa[];
  /** Abre a tarefa numa aba: o clique em qualquer ponto da linha. */
  onAbrirTarefa: (tarefa: Tarefa) => void;
  /** Edição rápida; ausente quando o usuário não pode editar. */
  onEditarTarefa?: (tarefa: Tarefa) => void;
  /** Envia para a Lixeira; ausente quando o usuário não pode. */
  onExcluirTarefa?: (tarefa: Tarefa) => void;
  /** Mensagem sem tarefas, quando a genérica não serve (ex.: subtarefas). */
  vazio?: string;
}) {
  if (tarefas.length === 0) return <TaskCardVazio mensagem={vazio} />;

  const comAcoes = Boolean(onEditarTarefa || onExcluirTarefa);

  return (
    <div className="divide-y rounded-lg border">
      {tarefas.map((tarefa) => {
        const atrasada = estaAtrasada(tarefa);

        return (
          <div key={tarefa.id} className={LINHA_DA_LISTA}>
            <ColunaDaLista largura="w-24">
              <StatusBadge status={tarefa.status} className="w-full justify-center" />
            </ColunaDaLista>

            <button
              type="button"
              onClick={() => onAbrirTarefa(tarefa)}
              className={cn(
                TITULO_DA_LINHA,
                tarefa.status === "CONCLUIDO" && "text-muted-foreground line-through",
              )}
            >
              {tarefa.title}
            </button>

            <ColunaDaLista largura="w-10" alinhar="fim">
              {tarefa._count.subtasks > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                  title={`${tarefa._count.subtasks} ${tarefa._count.subtasks === 1 ? "subtarefa" : "subtarefas"}`}
                >
                  <Icone icon={HierarchyIcon} className="size-4" aria-hidden />
                  {tarefa._count.subtasks}
                </span>
              )}
            </ColunaDaLista>

            <ColunaDaLista largura="w-20">
              <PriorityBadge priority={tarefa.priority} />
            </ColunaDaLista>

            <ColunaDaLista largura="w-24">
              <DifficultyBadge difficulty={tarefa.difficulty} mostrarVazio />
            </ColunaDaLista>

            <ColunaDaLista largura="w-24">
              {tarefa.dueDate && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px]",
                    atrasada ? "font-semibold text-destructive" : "text-muted-foreground",
                  )}
                >
                  <Icone icon={Calendar03Icon} className="size-4" aria-hidden />
                  {dataCurta(tarefa.dueDate)}
                </span>
              )}
            </ColunaDaLista>

            <ColunaDaLista largura="w-16" alinhar="fim">
              <Responsaveis usuarios={tarefa.assignees.map((a) => a.user)} max={2} />
            </ColunaDaLista>

            {comAcoes && (
              <AcoesDaLinha
                rotuloEditar={`Editar a tarefa “${tarefa.title}”`}
                rotuloExcluir={`Excluir a tarefa “${tarefa.title}”`}
                onEditar={onEditarTarefa && (() => onEditarTarefa(tarefa))}
                onExcluir={onExcluirTarefa && (() => onExcluirTarefa(tarefa))}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Visualização em Cards: etapas misturadas, a mais recente primeiro. A etapa
 * de cada tarefa fica no próprio cartão; separar por etapa é papel do Kanban.
 */
export function TaskCards({
  tarefas,
  onAbrirTarefa,
  onEditarTarefa,
  onExcluirTarefa,
  vazio,
}: {
  tarefas: Tarefa[];
  /** Abre a tarefa numa aba: o clique no corpo do cartão. */
  onAbrirTarefa: (tarefa: Tarefa) => void;
  /** Edição rápida; ausente quando o usuário não pode editar. */
  onEditarTarefa?: (tarefa: Tarefa) => void;
  /** Envia para a Lixeira; ausente quando o usuário não pode. */
  onExcluirTarefa?: (tarefa: Tarefa) => void;
  /** Mensagem sem tarefas, quando a genérica não serve (ex.: subtarefas). */
  vazio?: string;
}) {
  if (tarefas.length === 0) return <TaskCardVazio mensagem={vazio} />;

  return (
    <GradeDeCards>
      {porAlteracaoRecente(tarefas).map((tarefa) => (
        <TaskCard
          key={tarefa.id}
          tarefa={tarefa}
          onIrPara={() => onAbrirTarefa(tarefa)}
          onEditar={onEditarTarefa ? () => onEditarTarefa(tarefa) : undefined}
          onExcluir={onExcluirTarefa ? () => onExcluirTarefa(tarefa) : undefined}
        />
      ))}
    </GradeDeCards>
  );
}
