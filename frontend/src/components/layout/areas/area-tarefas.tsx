"use client";

import { ArrowMoveDownRightIcon, Task01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useExcluirTarefaComConfirmacao } from "@/components/confirmar-exclusao";
import { StatusDot } from "@/components/tasks/task-badges";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { useAbas } from "@/components/tabs/tabs-context";
import { Icone } from "@/components/ui/icone";
import { dataCurta } from "@/lib/datas";
import { t } from "@/lib/messages";
import { usePorPrioridade } from "@/lib/queries/tasks";
import type { Prioridade, Tarefa } from "@/lib/types";
import {
  SidebarEsqueleto,
  SidebarItem,
  SidebarSection,
  SidebarVazio,
} from "../sidebar-section";
import { abrirPaginaDaArea, abrirTarefaEm } from "./abrir";
import { ItemAcoesMenu } from "./item-acoes-menu";

const SECOES: Array<{ prioridade: Prioridade; titulo: string }> = [
  { prioridade: "ALTA", titulo: t.secoes.prioridadeAlta },
  { prioridade: "MEDIA", titulo: t.secoes.prioridadeMedia },
  { prioridade: "BAIXA", titulo: t.secoes.prioridadeBaixa },
];

/**
 * Tarefas, agrupadas pela prioridade que o próprio usuário definiu.
 *
 * Entram as tarefas em que ele é responsável e as da Caixa de entrada, com
 * Backlog e Em pausa: ele classificou a prioridade e continua querendo vê-las.
 * Só as concluídas ficam de fora. Criar tarefa é pela página "Todas as tarefas".
 */
export function AreaTarefas() {
  const [editando, setEditando] = useState<Tarefa | null>(null);
  const exclusao = useExcluirTarefaComConfirmacao();

  return (
    <>
      {SECOES.map(({ prioridade, titulo }) => (
        <SecaoDePrioridade
          key={prioridade}
          prioridade={prioridade}
          titulo={titulo}
          aoEditar={setEditando}
          aoExcluir={exclusao.pedir}
        />
      ))}

      <TaskDialog
        aberto={Boolean(editando)}
        aoFechar={() => setEditando(null)}
        taskId={editando?.id}
        projectId={editando?.projectId}
      />

      {exclusao.dialogo}
    </>
  );
}

function SecaoDePrioridade({
  prioridade,
  titulo,
  aoEditar,
  aoExcluir,
}: {
  prioridade: Prioridade;
  titulo: string;
  aoEditar: (tarefa: Tarefa) => void;
  aoExcluir: (tarefa: Tarefa) => void;
}) {
  const { data, isPending } = usePorPrioridade(prioridade);
  const { abrirAba, abaAtivaId } = useAbas();

  // A seção mostra no máximo 15; o atalho só aparece quando algo ficou de fora.
  const temMais = data !== undefined && data.total > data.itens.length;

  return (
    <SidebarSection
      titulo={titulo}
      aoVerTodos={temMais ? () => abrirPaginaDaArea(abrirAba, "tarefas") : undefined}
      rotuloVerTodos={temMais ? `Ver todas (${data.total})` : undefined}
    >
      {isPending ? (
        <SidebarEsqueleto linhas={2} />
      ) : data && data.itens.length > 0 ? (
        data.itens.map((tarefa) => (
          <SidebarItem
            key={tarefa.id}
            // Mesma distinção de "Recentes", na Home.
            icone={
              tarefa.parentId === null ? (
                <Icone icon={Task01Icon} className="size-4" />
              ) : (
                <Icone icon={ArrowMoveDownRightIcon} className="size-4" />
              )
            }
            titulo={tarefa.title}
            detalhe={
              <span className="inline-flex items-center gap-1.5">
                {tarefa.dueDate && dataCurta(tarefa.dueDate)}
                <StatusDot status={tarefa.status} />
              </span>
            }
            ativo={abaAtivaId === `tarefa:${tarefa.id}`}
            onClick={() => abrirTarefaEm(abrirAba, tarefa)}
            acoes={
              <ItemAcoesMenu
                rotulo={tarefa.title}
                onEditar={() => aoEditar(tarefa)}
                onExcluir={() => aoExcluir(tarefa)}
              />
            }
          />
        ))
      ) : (
        <SidebarVazio mensagem={t.vazio.semTarefas} />
      )}
    </SidebarSection>
  );
}
