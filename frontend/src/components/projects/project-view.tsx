"use client";

import { InboxIcon, PlusSignIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { GradeDeCardsEsqueleto } from "@/components/cards/grade-de-cards";
import { useExcluirTarefaComConfirmacao } from "@/components/confirmar-exclusao";
import { useFiltroDeResponsavel } from "@/components/filtro-de-responsavel";
import { useFiltrosDeNiveis } from "@/components/filtros-de-niveis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { abrirTarefaEm } from "@/components/layout/areas/abrir";
import {
  SeletorVisualizacao,
  UltimaAlteracao,
} from "@/components/layout/controles-da-pagina";
import { useAbas } from "@/components/tabs/tabs-context";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskKanban } from "@/components/tasks/task-kanban";
import { TaskCards, TaskList } from "@/components/tasks/task-list";
import { Icone } from "@/components/ui/icone";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/messages";
import { useVisualizacao } from "@/lib/queries/preferences";
import { useProjeto } from "@/lib/queries/projects";
import { useTarefasDoProjeto } from "@/lib/queries/tasks";
import type { StatusTarefa, Tarefa } from "@/lib/types";
import { ProjectMembersDialog } from "./project-members-dialog";

/**
 * Página de um projeto, aberta como aba.
 *
 * A visualização (Cards, Kanban ou Lista) vem da preferência salva no banco.
 * O seletor lê a mesma consulta, então os dois ficam sincronizados sem
 * precisar de estado compartilhado.
 */
export function ProjectView({ projectId }: { projectId: string }) {
  const { data, isPending, error } = useProjeto(projectId);
  const { data: tarefas } = useTarefasDoProjeto(projectId);
  const { visualizacao } = useVisualizacao("PROJETO", projectId);
  const { abrirAba } = useAbas();

  const [tarefaAberta, setTarefaAberta] = useState<string | null>(null);
  const [criando, setCriando] = useState<StatusTarefa | null>(null);
  const [gerenciandoMembros, setGerenciandoMembros] = useState(false);
  const exclusao = useExcluirTarefaComConfirmacao({ projectId });
  const niveis = useFiltrosDeNiveis();
  const responsavel = useFiltroDeResponsavel(data?.membros.map((m) => m.user) ?? []);

  if (isPending) return <Carregando />;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <p className="heading-section">Projeto indisponível</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof ApiError ? error.message : t.erros.generico}
          </p>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const podeEditar = data.meuPapel === "OWNER" || data.meuPapel === "EDITOR";
  const ehCaixa = data.projeto.isInbox;
  const total = tarefas?.length ?? 0;
  // Na Caixa de entrada não há filtro de responsável: ele nem aparece.
  const filtrando = niveis.ativo || (!ehCaixa && responsavel.ativo);
  const lista = (tarefas ?? []).filter(
    (tarefa) => niveis.aceita(tarefa) && (ehCaixa || responsavel.aceita(tarefa)),
  );
  const quantidadeDePessoas = data.membros.length;

  /** Edição rápida (diálogo). */
  function editarTarefa(tarefa: Tarefa) {
    setTarefaAberta(tarefa.id);
  }

  /** "Ir para": a tarefa na própria aba. */
  function irParaTarefa(tarefa: Tarefa) {
    abrirTarefaEm(abrirAba, tarefa);
  }

  return (
    <div className="flex h-full flex-col">
      {/*
       * À esquerda, o que o projeto é: título, descrição e contagem. À
       * direita, o que se faz com as tarefas (filtros, visualização, criar)
       * e, logo abaixo, os dados do projeto (alteração, papel, pessoas).
       */}
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-3 px-6 pt-5 pb-3">
        <div className="min-w-0 flex-1 basis-64 space-y-1">
          <h1 className="flex items-center gap-2 truncate text-lg font-semibold tracking-tight">
            {ehCaixa && (
              <Icone icon={InboxIcon} aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            )}
            {data.projeto.name}
          </h1>
          {data.projeto.description && (
            <p
              className="line-clamp-2 text-sm text-muted-foreground"
              title={data.projeto.description}
            >
              {data.projeto.description}
            </p>
          )}
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {[
              data.equipe?.name,
              filtrando
                ? `${lista.length} de ${total} ${total === 1 ? "tarefa" : "tarefas"}`
                : `${total} ${total === 1 ? "tarefa" : "tarefas"}`,
              data.viaGestorDaEquipe ? "acesso como gestor da equipe" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 max-md:w-full max-md:items-start">
          <div className="flex flex-wrap items-center justify-end gap-2 max-md:justify-start">
            {!ehCaixa && responsavel.controle}
            {niveis.controles}
            <SeletorVisualizacao tipo="PROJETO" recursoId={projectId} />
            {podeEditar && (
              <Button size="sm" onClick={() => setCriando("A_FAZER")}>
                <Icone icon={PlusSignIcon} />
                Nova tarefa
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <UltimaAlteracao
              autor={data.projeto.updatedBy}
              alteradoEm={data.projeto.updatedAt}
              criadoEm={data.projeto.createdAt}
            />
            {!ehCaixa && (
              <>
                <Badge variant="secondary">{t.papelProjeto[data.meuPapel]}</Badge>
                {/* Todos veem quantas pessoas há; só o dono gerencia. */}
                {data.meuPapel === "OWNER" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGerenciandoMembros(true)}
                    aria-label={`Gerenciar pessoas (${quantidadeDePessoas})`}
                  >
                    <Icone icon={UserGroupIcon} />
                    {quantidadeDePessoas}
                  </Button>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    title={`${quantidadeDePessoas} ${quantidadeDePessoas === 1 ? "pessoa" : "pessoas"}`}
                  >
                    <Icone icon={UserGroupIcon} className="size-4" aria-hidden />
                    {quantidadeDePessoas}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
        {visualizacao === "KANBAN" ? (
          <TaskKanban
            tarefas={lista}
            podeEditar={podeEditar}
            onAbrirTarefa={irParaTarefa}
            onEditarTarefa={editarTarefa}
            onExcluirTarefa={exclusao.pedir}
            onNovaTarefa={(status) => setCriando(status)}
            etapaAceita={niveis.etapaAceita}
          />
        ) : visualizacao === "LISTA" ? (
          <TaskList
            tarefas={lista}
            onAbrirTarefa={irParaTarefa}
            onEditarTarefa={podeEditar ? editarTarefa : undefined}
            onExcluirTarefa={podeEditar ? exclusao.pedir : undefined}
          />
        ) : (
          <TaskCards
            tarefas={lista}
            onAbrirTarefa={irParaTarefa}
            onEditarTarefa={podeEditar ? editarTarefa : undefined}
            onExcluirTarefa={podeEditar ? exclusao.pedir : undefined}
          />
        )}
      </div>

      {exclusao.dialogo}

      <TaskDialog
        aberto={Boolean(tarefaAberta)}
        aoFechar={() => setTarefaAberta(null)}
        taskId={tarefaAberta}
        projectId={projectId}
        membros={data.membros}
        podeEditar={podeEditar}
      />

      <TaskDialog
        aberto={Boolean(criando)}
        aoFechar={() => setCriando(null)}
        projectId={projectId}
        statusInicial={criando ?? undefined}
        membros={data.membros}
      />

      <ProjectMembersDialog
        aberto={gerenciandoMembros}
        aoFechar={() => setGerenciandoMembros(false)}
        projectId={projectId}
        detalhe={data}
      />
    </div>
  );
}

function Carregando() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-6 w-56 animate-pulse rounded bg-muted" />
      <GradeDeCardsEsqueleto />
    </div>
  );
}
