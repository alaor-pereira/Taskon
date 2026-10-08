"use client";

import { HierarchyIcon } from "@hugeicons/core-free-icons";
import { ItemCard } from "@/components/cards/item-card";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/messages";
import type { Tarefa } from "@/lib/types";
import { prazoVencido } from "./task-badges";

/**
 * Cartão de tarefa, usado na visualização Cards e como cartão do Kanban.
 * O corpo abre a tarefa numa aba; no Kanban, onde ele serve para arrastar,
 * quem abre é a seta "Ir para". "Editar" abre a edição rápida e "Excluir"
 * envia para a Lixeira; os dois só aparecem para quem pode.
 */
export function TaskCard({
  tarefa,
  onIrPara,
  onEditar,
  onExcluir,
  arrastavel,
  irParaNoRodape,
  className,
}: {
  tarefa: Tarefa;
  onIrPara: () => void;
  onEditar?: () => void;
  onExcluir?: () => void;
  /** Cartão do Kanban: o corpo só arrasta. */
  arrastavel?: boolean;
  /** Seta "Ir para" no rodapé, no Kanban. */
  irParaNoRodape?: boolean;
  className?: string;
}) {
  const subtarefas = tarefa._count.subtasks;

  return (
    <ItemCard
      titulo={tarefa.title}
      descricao={tarefa.description}
      status={tarefa.status}
      prioridade={tarefa.priority}
      dificuldade={tarefa.difficulty}
      prazo={tarefa.dueDate}
      contagem={
        subtarefas > 0 && (
          <span
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
            title={`${subtarefas} ${subtarefas === 1 ? "subtarefa" : "subtarefas"}`}
          >
            <Icone icon={HierarchyIcon} className="size-4" aria-hidden />
            {subtarefas}
            <span className="sr-only">{subtarefas === 1 ? "subtarefa" : "subtarefas"}</span>
          </span>
        )
      }
      pessoas={tarefa.assignees.map((a) => a.user)}
      semPessoas="Sem responsáveis"
      rotuloIrPara={`Abrir a tarefa “${tarefa.title}”`}
      rotuloEditar={`Editar a tarefa “${tarefa.title}”`}
      rotuloExcluir={`Excluir a tarefa “${tarefa.title}”`}
      onIrPara={onIrPara}
      onEditar={onEditar}
      onExcluir={onExcluir}
      arrastavel={arrastavel}
      irParaNoRodape={irParaNoRodape}
      className={className}
    />
  );
}

/** Atrasada só vale para trabalho ativo: A fazer, Em andamento e Em revisão. */
export function estaAtrasada(tarefa: Tarefa): boolean {
  return prazoVencido(tarefa.status, tarefa.dueDate);
}

export function TaskCardVazio({ mensagem = t.vazio.semTarefasNaLista }: { mensagem?: string }) {
  return (
    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {mensagem}
    </p>
  );
}
