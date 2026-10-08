"use client";

import {
  ArrowMoveDownRightIcon,
  Clock01Icon,
  DashboardSpeed01Icon,
  InboxIcon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useExcluirTarefaComConfirmacao } from "@/components/confirmar-exclusao";
import { useAbas } from "@/components/tabs/tabs-context";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { Icone } from "@/components/ui/icone";
import { dataCurta, tempoRelativo } from "@/lib/datas";
import { t } from "@/lib/messages";
import { useProjetos } from "@/lib/queries/projects";
import { useRecentes, useVencemHoje, useVencidas } from "@/lib/queries/tasks";
import type { Tarefa } from "@/lib/types";
import {
  SidebarEsqueleto,
  SidebarItem,
  SidebarSection,
  SidebarVazio,
} from "../sidebar-section";
import { abrirProjetoEm, abrirTarefaEm } from "./abrir";
import { ItemAcoesMenu } from "./item-acoes-menu";

/**
 * Home: Visão Geral, Recentes, Vencem Hoje e Vencidas.
 *
 * "Recentes" mostra o que mudou nos projetos que acesso, por qualquer pessoa.
 * "Vencem Hoje" e "Vencidas" mostram só o que é meu.
 */
export function AreaHome() {
  const { abrirAba, abaAtivaId } = useAbas();
  const { data: projetos } = useProjetos();
  const recentes = useRecentes();
  const vencemHoje = useVencemHoje();
  const vencidas = useVencidas();
  const [editando, setEditando] = useState<Tarefa | null>(null);
  const exclusao = useExcluirTarefaComConfirmacao();

  return (
    <>
      <SidebarSection titulo={t.secoes.visaoGeral}>
        <SidebarItem
          icone={<Icone icon={DashboardSpeed01Icon} className="size-4" />}
          titulo={t.secoes.dashboard}
          ativo={abaAtivaId === "dashboard"}
          onClick={() =>
            abrirAba({ id: "dashboard", tipo: "dashboard", titulo: t.secoes.dashboard })
          }
        />
        {projetos?.caixaDeEntrada && (
          <SidebarItem
            icone={<Icone icon={InboxIcon} className="size-4" />}
            titulo={t.secoes.caixaDeEntrada}
            ativo={abaAtivaId === `projeto:${projetos.caixaDeEntrada.id}`}
            onClick={() =>
              projetos.caixaDeEntrada &&
              abrirProjetoEm(abrirAba, projetos.caixaDeEntrada)
            }
          />
        )}
      </SidebarSection>

      <SidebarSection titulo={t.secoes.recentes}>
        {recentes.isPending ? (
          <SidebarEsqueleto linhas={3} />
        ) : recentes.data && recentes.data.length > 0 ? (
          recentes.data.map(({ tarefa, alteradoEm }) => (
            <SidebarItem
              key={tarefa.id}
              icone={
                tarefa.parentId === null ? (
                  <Icone icon={Task01Icon} className="size-4" />
                ) : (
                  <Icone icon={ArrowMoveDownRightIcon} className="size-4" />
                )
              }
              titulo={tarefa.title}
              detalhe={tempoRelativo(alteradoEm)}
              ativo={abaAtivaId === `tarefa:${tarefa.id}`}
              onClick={() => abrirTarefaEm(abrirAba, tarefa)}
              acoes={
                <ItemAcoesMenu
                  rotulo={tarefa.title}
                  onEditar={() => setEditando(tarefa)}
                  onExcluir={() => exclusao.pedir(tarefa)}
                />
              }
            />
          ))
        ) : (
          <SidebarVazio mensagem={t.vazio.semTarefasRecentes} />
        )}
      </SidebarSection>

      <SidebarSection titulo={t.secoes.vencemHoje}>
        {vencemHoje.isPending ? (
          <SidebarEsqueleto linhas={2} />
        ) : vencemHoje.data && vencemHoje.data.length > 0 ? (
          vencemHoje.data.map((tarefa: Tarefa) => (
            <SidebarItem
              key={tarefa.id}
              icone={<Icone icon={Clock01Icon} className="size-4" />}
              titulo={tarefa.title}
              ativo={abaAtivaId === `tarefa:${tarefa.id}`}
              onClick={() => abrirTarefaEm(abrirAba, tarefa)}
              acoes={
                <ItemAcoesMenu
                  rotulo={tarefa.title}
                  onEditar={() => setEditando(tarefa)}
                  onExcluir={() => exclusao.pedir(tarefa)}
                />
              }
            />
          ))
        ) : (
          <SidebarVazio mensagem={t.vazio.semTarefasHoje} />
        )}
      </SidebarSection>

      <SidebarSection titulo={t.secoes.vencidas}>
        {vencidas.isPending ? (
          <SidebarEsqueleto linhas={2} />
        ) : vencidas.data && vencidas.data.length > 0 ? (
          vencidas.data.map((tarefa: Tarefa) => (
            <SidebarItem
              key={tarefa.id}
              icone={<Icone icon={Clock01Icon} className="size-4" />}
              titulo={tarefa.title}
              detalhe={tarefa.dueDate ? dataCurta(tarefa.dueDate) : undefined}
              ativo={abaAtivaId === `tarefa:${tarefa.id}`}
              onClick={() => abrirTarefaEm(abrirAba, tarefa)}
              acoes={
                <ItemAcoesMenu
                  rotulo={tarefa.title}
                  onEditar={() => setEditando(tarefa)}
                  onExcluir={() => exclusao.pedir(tarefa)}
                />
              }
            />
          ))
        ) : (
          <SidebarVazio mensagem={t.vazio.semTarefasVencidas} />
        )}
      </SidebarSection>

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
