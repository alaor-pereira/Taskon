"use client";

import { useState } from "react";
import { GradeDeCardsEsqueleto } from "@/components/cards/grade-de-cards";
import { useExcluirProjetoComConfirmacao } from "@/components/confirmar-exclusao";
import { abrirProjetoEm } from "@/components/layout/areas/abrir";
import { CriarProjetoDialog } from "@/components/projects/criar-projeto-dialog";
import { EditarProjetoDialog } from "@/components/projects/editar-projeto-dialog";
import { ProjectCards, ProjectCardVazio } from "@/components/projects/project-card";
import { SeletorSegmentado } from "@/components/seletor-segmentado";
import { useAbas } from "@/components/tabs/tabs-context";
import { Button } from "@/components/ui/button";
import type { Projeto } from "@/lib/types";

type FiltroStatus = "TODOS" | "ATIVOS" | "CONCLUIDOS";

const FILTROS: Array<{ valor: FiltroStatus; rotulo: string }> = [
  { valor: "TODOS", rotulo: "Todos" },
  { valor: "ATIVOS", rotulo: "Ativos" },
  { valor: "CONCLUIDOS", rotulo: "Concluídos" },
];

/**
 * Projetos da equipe que o usuário enxerga — a lista vem de "Todos os
 * projetos", filtrada pela equipe, então não revela projeto a quem não tem
 * acesso. Visão rápida em cartões; Kanban e Lista ficam na página geral.
 */
export function TeamProjetos({
  teamId,
  projetos,
  carregando,
  podeCriar,
}: {
  teamId: string;
  projetos: Projeto[];
  carregando: boolean;
  podeCriar: boolean;
}) {
  const { abrirAba } = useAbas();
  const [filtro, setFiltro] = useState<FiltroStatus>("TODOS");
  const [criando, setCriando] = useState(false);
  const exclusao = useExcluirProjetoComConfirmacao();
  const [editando, setEditando] = useState<Projeto | null>(null);

  const visiveis = projetos.filter((p) =>
    filtro === "TODOS"
      ? true
      : filtro === "CONCLUIDOS"
        ? p.status === "CONCLUIDO"
        : p.status !== "CONCLUIDO",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SeletorSegmentado
          opcoes={FILTROS}
          valor={filtro}
          aoMudar={setFiltro}
          rotulo="Filtrar por status"
        />
        <span className="flex-1" />
        {podeCriar && <Button onClick={() => setCriando(true)}>Novo projeto</Button>}
      </div>

      {carregando ? (
        <GradeDeCardsEsqueleto quantidade={4} />
      ) : visiveis.length === 0 ? (
        <ProjectCardVazio
          mensagem={
            projetos.length === 0
              ? "Esta equipe ainda não tem projetos que você possa ver."
              : "Nenhum projeto neste filtro."
          }
        />
      ) : (
        <ProjectCards
          projetos={visiveis}
          onAbrirProjeto={(projeto) => abrirProjetoEm(abrirAba, projeto)}
          onEditarProjeto={setEditando}
          onExcluirProjeto={exclusao.pedir}
        />
      )}

      {exclusao.dialogo}

      <EditarProjetoDialog
        aberto={Boolean(editando)}
        aoFechar={() => setEditando(null)}
        projeto={editando}
      />

      {podeCriar && (
        <CriarProjetoDialog
          aberto={criando}
          aoFechar={() => setCriando(false)}
          equipeInicial={teamId}
        />
      )}
    </div>
  );
}
