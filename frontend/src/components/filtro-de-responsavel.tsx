"use client";

import { useState } from "react";
import { FiltroSelect } from "@/components/filtro-select";
import type { UsuarioResumo } from "@/lib/types";

const TODOS = "TODOS";
const SEM_RESPONSAVEL = "SEM_RESPONSAVEL";

/**
 * Filtro de responsável: todos, sem responsável ou uma pessoa. Como os de
 * nível, volta ao padrão quando a página é reaberta.
 *
 * Se a pessoa escolhida sair da lista (deixou o projeto, ou a lista de
 * tarefas mudou), o filtro passa a valer "Todos" — derivado no render, para
 * não esconder tudo por causa de alguém que nem aparece mais nas opções.
 */
export function useFiltroDeResponsavel(pessoas: UsuarioResumo[]) {
  const [escolhido, setEscolhido] = useState<string>(TODOS);

  const ordenadas = [...pessoas].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const valor =
    escolhido === TODOS ||
    escolhido === SEM_RESPONSAVEL ||
    ordenadas.some((p) => p.id === escolhido)
      ? escolhido
      : TODOS;

  function aceita(tarefa: { assignees: Array<{ user: { id: string } }> }) {
    if (valor === TODOS) return true;
    if (valor === SEM_RESPONSAVEL) return tarefa.assignees.length === 0;
    return tarefa.assignees.some((a) => a.user.id === valor);
  }

  const controle = (
    <FiltroSelect
      rotulo="Responsável"
      valor={valor}
      padrao={TODOS}
      opcoes={[
        { valor: TODOS, rotulo: "Todos" },
        { valor: SEM_RESPONSAVEL, rotulo: "Sem responsável" },
        ...ordenadas.map((p) => ({ valor: p.id, rotulo: p.name })),
      ]}
      aoMudar={setEscolhido}
    />
  );

  return { aceita, controle, ativo: valor !== TODOS };
}
