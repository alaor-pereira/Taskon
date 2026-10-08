"use client";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { GradeDeCardsEsqueleto } from "@/components/cards/grade-de-cards";
import { useExcluirProjetoComConfirmacao } from "@/components/confirmar-exclusao";
import { FiltroSelect } from "@/components/filtro-select";
import { useFiltrosDeNiveis } from "@/components/filtros-de-niveis";
import { abrirProjetoEm } from "@/components/layout/areas/abrir";
import { ViewSwitcher } from "@/components/layout/view-switcher";
import { useAbas } from "@/components/tabs/tabs-context";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/messages";
import { useVisualizacaoDaPagina } from "@/lib/queries/preferences";
import { useTodosOsProjetos } from "@/lib/queries/projects";
import type { Projeto } from "@/lib/types";
import { CriarProjetoDialog } from "./criar-projeto-dialog";
import { EditarProjetoDialog } from "./editar-projeto-dialog";
import { ProjectCards, ProjectList } from "./project-card";
import { ProjectKanban } from "./project-kanban";

const TODOS = "TODOS";
const ESCOPOS = [
  { valor: TODOS, rotulo: "Todos" },
  { valor: "PESSOAL", rotulo: "Pessoais" },
  { valor: "EQUIPE", rotulo: "Em equipe" },
];

/**
 * Todos os projetos: cards/kanban/lista, filtráveis por escopo, prioridade e
 * dificuldade. Em todas as visualizações, abrir leva o projeto para uma aba,
 * "Editar" abre o diálogo de edição e "Excluir" (só do dono) envia para a
 * Lixeira.
 */
export function TodosOsProjetosView() {
  const { abrirAba } = useAbas();
  const { data, isPending } = useTodosOsProjetos();
  const {
    visualizacao,
    definir: setVisualizacao,
    carregando: carregandoVisualizacao,
  } = useVisualizacaoDaPagina("TODOS_PROJETOS", "CARDS");
  const [escopo, setEscopo] = useState<string>(TODOS);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Projeto | null>(null);
  const niveis = useFiltrosDeNiveis();
  const exclusao = useExcluirProjetoComConfirmacao();

  const projetos = (data ?? []).filter(
    (p) => (escopo === TODOS || p.escopo === escopo) && niveis.aceita(p),
  );
  const irPara = (projeto: Projeto) => abrirProjetoEm(abrirAba, projeto);

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-6 pt-5 pb-3">
        <h1 className="heading-section flex-1">{t.paginas.todosProjetos}</h1>

        <div className="flex flex-wrap items-center gap-2">
          <FiltroSelect
            rotulo="Escopo"
            valor={escopo}
            padrao={TODOS}
            opcoes={ESCOPOS}
            aoMudar={setEscopo}
          />
          {niveis.controles}
        </div>

        <ViewSwitcher value={visualizacao} onChange={setVisualizacao} />

        <Button onClick={() => setCriando(true)}>
          <Icone icon={PlusSignIcon} />
          Novo projeto
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
        {isPending || carregandoVisualizacao ? (
          <GradeDeCardsEsqueleto altura="h-32" />
        ) : visualizacao === "KANBAN" ? (
          // Mesmo vazio o Kanban aparece: com filtro de etapa, as colunas
          // apagadas mostram que há um filtro escondendo o resto.
          <ProjectKanban
            projetos={projetos}
            onAbrirProjeto={irPara}
            onEditarProjeto={setEditando}
            onExcluirProjeto={exclusao.pedir}
            etapaAceita={niveis.etapaAceita}
          />
        ) : visualizacao === "LISTA" ? (
          <ProjectList
            projetos={projetos}
            onAbrirProjeto={irPara}
            onEditarProjeto={setEditando}
            onExcluirProjeto={exclusao.pedir}
          />
        ) : (
          <ProjectCards
            projetos={projetos}
            onAbrirProjeto={irPara}
            onEditarProjeto={setEditando}
            onExcluirProjeto={exclusao.pedir}
          />
        )}
      </div>

      {exclusao.dialogo}

      {criando && <CriarProjetoDialog aberto aoFechar={() => setCriando(false)} />}

      <EditarProjetoDialog
        aberto={Boolean(editando)}
        aoFechar={() => setEditando(null)}
        projeto={editando}
      />
    </div>
  );
}
