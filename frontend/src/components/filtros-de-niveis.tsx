"use client";

import { useState } from "react";
import { FiltroSelect, type OpcaoDeFiltro } from "@/components/filtro-select";
import { t } from "@/lib/messages";
import type { Dificuldade, Prioridade, StatusTarefa } from "@/lib/types";

const TODAS = "TODAS";
const NAO_ESTIMADA = "NAO_ESTIMADA";
const EM_ABERTO = "EM_ABERTO";

/** Mesma ordem das colunas do Kanban. */
const ETAPAS: StatusTarefa[] = [
  "BACKLOG",
  "A_FAZER",
  "EM_ANDAMENTO",
  "EM_REVISAO",
  "EM_PAUSA",
  "CONCLUIDO",
];

type FiltroPrioridade = typeof TODAS | Prioridade;
type FiltroDificuldade = typeof TODAS | typeof NAO_ESTIMADA | Dificuldade;
type FiltroEtapa = typeof TODAS | typeof EM_ABERTO | StatusTarefa;

/** Rótulos curtos: o nome do filtro já aparece no gatilho ("Etapa: …"). */
const OPCOES_DE_ETAPA: OpcaoDeFiltro<FiltroEtapa>[] = [
  { valor: TODAS, rotulo: "Todas" },
  { valor: EM_ABERTO, rotulo: "Em aberto" },
  ...ETAPAS.map((e) => ({ valor: e, rotulo: t.status[e] })),
];
const OPCOES_DE_PRIORIDADE: OpcaoDeFiltro<FiltroPrioridade>[] = [
  { valor: TODAS, rotulo: "Todas" },
  { valor: "ALTA", rotulo: t.prioridade.ALTA },
  { valor: "MEDIA", rotulo: t.prioridade.MEDIA },
  { valor: "BAIXA", rotulo: t.prioridade.BAIXA },
];
const OPCOES_DE_DIFICULDADE: OpcaoDeFiltro<FiltroDificuldade>[] = [
  { valor: TODAS, rotulo: "Todas" },
  { valor: "ROTINEIRO", rotulo: t.dificuldade.ROTINEIRO },
  { valor: "COMPLEXO", rotulo: t.dificuldade.COMPLEXO },
  { valor: "CRITICO", rotulo: t.dificuldade.CRITICO },
  { valor: NAO_ESTIMADA, rotulo: t.dificuldade.naoEstimada },
];

/**
 * Filtros de etapa, prioridade e dificuldade das páginas "Todos os projetos"
 * e "Todas as tarefas": uma opção por vez, e voltam ao padrão quando a página
 * é reaberta — um filtro esquecido ativo esconderia itens sem aviso.
 */
export function useFiltrosDeNiveis() {
  const [etapa, setEtapa] = useState<FiltroEtapa>(TODAS);
  const [prioridade, setPrioridade] = useState<FiltroPrioridade>(TODAS);
  const [dificuldade, setDificuldade] = useState<FiltroDificuldade>(TODAS);

  /** Se a etapa passa no filtro — o Kanban usa para apagar as colunas de fora. */
  function etapaAceita(status: StatusTarefa) {
    if (etapa === TODAS) return true;
    if (etapa === EM_ABERTO) return status !== "CONCLUIDO";
    return status === etapa;
  }

  function aceita(item: {
    status: StatusTarefa;
    priority: Prioridade;
    difficulty: Dificuldade | null;
  }) {
    if (!etapaAceita(item.status)) return false;
    if (prioridade !== TODAS && item.priority !== prioridade) return false;
    if (dificuldade === NAO_ESTIMADA) return item.difficulty === null;
    if (dificuldade !== TODAS && item.difficulty !== dificuldade) return false;
    return true;
  }

  const controles = (
    <>
      <FiltroSelect
        rotulo="Etapa"
        valor={etapa}
        padrao={TODAS}
        opcoes={OPCOES_DE_ETAPA}
        aoMudar={setEtapa}
      />
      <FiltroSelect
        rotulo="Prioridade"
        valor={prioridade}
        padrao={TODAS}
        opcoes={OPCOES_DE_PRIORIDADE}
        aoMudar={setPrioridade}
      />
      <FiltroSelect
        rotulo="Dificuldade"
        valor={dificuldade}
        padrao={TODAS}
        opcoes={OPCOES_DE_DIFICULDADE}
        aoMudar={setDificuldade}
      />
    </>
  );

  return {
    aceita,
    controles,
    /** Algum nível fora de "Todas" — a página mostra "X de Y". */
    ativo: etapa !== TODAS || prioridade !== TODAS || dificuldade !== TODAS,
    /** Ausente sem filtro de etapa, para o Kanban não apagar nada à toa. */
    etapaAceita: etapa === TODAS ? undefined : etapaAceita,
  };
}
