"use client";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { GradeDeCardsEsqueleto } from "@/components/cards/grade-de-cards";
import { useExcluirTarefaComConfirmacao } from "@/components/confirmar-exclusao";
import { FiltroSelect } from "@/components/filtro-select";
import { useFiltroDeResponsavel } from "@/components/filtro-de-responsavel";
import { useFiltrosDeNiveis } from "@/components/filtros-de-niveis";
import { abrirTarefaEm } from "@/components/layout/areas/abrir";
import { ViewSwitcher } from "@/components/layout/view-switcher";
import { useAbas } from "@/components/tabs/tabs-context";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/messages";
import { useProjetosDoFiltro } from "@/lib/queries/dashboard";
import { useVisualizacaoDaPagina } from "@/lib/queries/preferences";
import { useTodasAsTarefas } from "@/lib/queries/tasks";
import type { StatusTarefa, Tarefa, UsuarioResumo } from "@/lib/types";
import { TaskDialog } from "./task-dialog";
import { TaskKanban } from "./task-kanban";
import { TaskCards, TaskList } from "./task-list";

const TODOS = "todos";

/**
 * Todas as tarefas: as atribuídas a mim e as da Caixa de entrada,
 * de todo projeto, filtráveis por projeto, prioridade e dificuldade, nas três
 * visualizações. Em todas, abrir leva a tarefa para uma aba (o corpo do
 * cartão, a linha da Lista, a seta do Kanban), "Editar" abre a edição rápida e
 * "Excluir" envia para a Lixeira.
 */
export function TodasAsTarefasView() {
  const {
    visualizacao,
    definir: setVisualizacao,
    carregando: carregandoVisualizacao,
  } = useVisualizacaoDaPagina("TODAS_TAREFAS", "LISTA");
  const [projectId, setProjectId] = useState<string>(TODOS);
  const { data: projetos } = useProjetosDoFiltro();
  const { data: tarefas, isPending } = useTodasAsTarefas(
    projectId === TODOS ? undefined : projectId,
  );

  const [tarefaAberta, setTarefaAberta] = useState<Tarefa | null>(null);
  const [criando, setCriando] = useState<StatusTarefa | null>(null);

  const { abrirAba } = useAbas();
  const niveis = useFiltrosDeNiveis();
  const exclusao = useExcluirTarefaComConfirmacao();

  // As opções de responsável são as pessoas que aparecem nas tarefas listadas.
  const pessoas = useMemo(() => {
    const porId = new Map<string, UsuarioResumo>();
    for (const tarefa of tarefas ?? []) {
      for (const { user } of tarefa.assignees) porId.set(user.id, user);
    }
    return [...porId.values()];
  }, [tarefas]);
  const responsavel = useFiltroDeResponsavel(pessoas);

  const lista = (tarefas ?? []).filter(
    (tarefa) => niveis.aceita(tarefa) && responsavel.aceita(tarefa),
  );
  const irPara = (tarefa: Tarefa) => abrirTarefaEm(abrirAba, tarefa);

  // A Caixa de entrada também aparece no filtro, mas no diálogo ela é o
  // valor padrão (projeto nulo), não um projeto da lista.
  const filtroEhCaixa = projetos?.find((p) => p.id === projectId)?.isInbox ?? false;
  const projetoParaCriar = projectId === TODOS || filtroEhCaixa ? null : projectId;

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-6 pt-5 pb-3">
        <h1 className="heading-section flex-1">{t.paginas.todasTarefas}</h1>

        <div className="flex flex-wrap items-center gap-2">
          <FiltroSelect
            rotulo="Projeto"
            valor={projectId}
            padrao={TODOS}
            opcoes={[
              { valor: TODOS, rotulo: "Todos" },
              ...(projetos ?? []).map((p) => ({ valor: p.id, rotulo: p.name })),
            ]}
            aoMudar={setProjectId}
          />
          {responsavel.controle}
          {niveis.controles}
        </div>

        <ViewSwitcher value={visualizacao} onChange={setVisualizacao} />

        <Button onClick={() => setCriando("A_FAZER")}>
          <Icone icon={PlusSignIcon} />
          Nova tarefa
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
        {isPending || carregandoVisualizacao ? (
          <GradeDeCardsEsqueleto />
        ) : visualizacao === "KANBAN" ? (
          <TaskKanban
            tarefas={lista}
            podeEditar
            onAbrirTarefa={irPara}
            onEditarTarefa={setTarefaAberta}
            onExcluirTarefa={exclusao.pedir}
            onNovaTarefa={(status) => setCriando(status)}
            etapaAceita={niveis.etapaAceita}
          />
        ) : visualizacao === "LISTA" ? (
          <TaskList
            tarefas={lista}
            onAbrirTarefa={irPara}
            onEditarTarefa={setTarefaAberta}
            onExcluirTarefa={exclusao.pedir}
          />
        ) : (
          <TaskCards
            tarefas={lista}
            onAbrirTarefa={irPara}
            onEditarTarefa={setTarefaAberta}
            onExcluirTarefa={exclusao.pedir}
          />
        )}
      </div>

      {exclusao.dialogo}

      <TaskDialog
        aberto={Boolean(tarefaAberta)}
        aoFechar={() => setTarefaAberta(null)}
        taskId={tarefaAberta?.id}
        projectId={tarefaAberta?.projectId}
      />

      {criando && (
        <TaskDialog
          aberto
          aoFechar={() => setCriando(null)}
          projectId={projetoParaCriar}
          statusInicial={criando}
          escolherProjeto
        />
      )}
    </div>
  );
}
