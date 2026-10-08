"use client";

import { ViewSwitcher } from "@/components/layout/view-switcher";
import { tempoRelativo } from "@/lib/datas";
import { ultimaAlteracaoPor } from "@/lib/messages";
import { useVisualizacao } from "@/lib/queries/preferences";
import type { Visualizacao } from "@/lib/types";

/**
 * Controles do canto superior direito das páginas de projeto e tarefa, ao
 * lado do botão principal. Moravam no header de abas, onde disputavam espaço
 * com as abas e quebravam a linha.
 */

/**
 * Cards, Kanban ou Lista, guardado no banco por usuário e por página.
 * A página lê a mesma consulta, então os dois ficam sincronizados.
 */
export function SeletorVisualizacao({
  tipo,
  recursoId,
  padrao,
}: {
  tipo: "PROJETO" | "TAREFA";
  recursoId: string;
  padrao?: Visualizacao;
}) {
  const { visualizacao, definir } = useVisualizacao(tipo, recursoId, padrao);
  return <ViewSwitcher value={visualizacao} onChange={definir} />;
}

/** "Alterado por Fulano há 2 h", ou "Criado há 3 d" quando ninguém alterou. */
export function UltimaAlteracao({
  autor,
  alteradoEm,
  criadoEm,
}: {
  autor: { name: string } | null | undefined;
  alteradoEm: string;
  criadoEm: string;
}) {
  const texto = autor
    ? ultimaAlteracaoPor(autor.name, tempoRelativo(alteradoEm))
    : `Criado ${tempoRelativo(criadoEm)}`;

  return (
    <span
      className="hidden max-w-64 truncate text-xs text-muted-foreground md:inline"
      title={texto}
    >
      {texto}
    </span>
  );
}
