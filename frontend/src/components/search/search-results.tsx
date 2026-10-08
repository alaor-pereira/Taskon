"use client";

import {
  CheckmarkSquare02Icon,
  InboxIcon,
  KanbanIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { useAbas } from "@/components/tabs/tabs-context";
import { StatusBadge } from "@/components/tasks/task-badges";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/messages";
import { useBusca } from "@/lib/queries/search";
import type { ResultadoDaBusca } from "@/lib/types";
import {
  abrirEquipeEm,
  abrirProjetoEm,
  abrirTarefaEm,
} from "@/components/layout/areas/abrir";

/**
 * Resultados da busca, agrupados por tipo.
 *
 * O que chega aqui já veio filtrado pela permissão no servidor — o cliente
 * nunca recebe o que não pode ver, nem para descartar depois.
 */
export function SearchResults({
  termo,
  aoEscolher,
}: {
  termo: string;
  aoEscolher: () => void;
}) {
  const { data, isPending } = useBusca(termo);
  const { abrirAba } = useAbas();

  if (termo.trim().length < 2) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">
        Digite ao menos duas letras para buscar.
      </p>
    );
  }

  if (isPending) {
    return (
      <div className="space-y-1 p-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-7 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">
        Nada encontrado para “{termo.trim()}”.
      </p>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto p-1">
      <Grupo titulo={t.nav.projetos} itens={data.projetos}>
        {(projeto) => (
          <Linha
            key={projeto.id}
            icone={
              projeto.isInbox ? (
                <Icone icon={InboxIcon} className="size-4" />
              ) : (
                <Icone icon={KanbanIcon} className="size-4" />
              )
            }
            titulo={projeto.name}
            legenda={projeto.team?.name}
            onClick={() => {
              abrirProjetoEm(abrirAba, projeto);
              aoEscolher();
            }}
          />
        )}
      </Grupo>

      <Grupo titulo={t.nav.tarefas} itens={data.tarefas}>
        {(tarefa) => (
          <Linha
            key={tarefa.id}
            icone={<Icone icon={CheckmarkSquare02Icon} className="size-4" />}
            titulo={tarefa.title}
            legenda={tarefa.project.name}
            extra={<StatusBadge status={tarefa.status} />}
            onClick={() => {
              abrirTarefaEm(abrirAba, tarefa);
              aoEscolher();
            }}
          />
        )}
      </Grupo>

      <Grupo titulo={t.nav.equipes} itens={data.equipes}>
        {(equipe) => (
          <Linha
            key={equipe.id}
            icone={<Icone icon={UserGroupIcon} className="size-4" />}
            titulo={equipe.name}
            onClick={() => {
              abrirEquipeEm(abrirAba, equipe);
              aoEscolher();
            }}
          />
        )}
      </Grupo>
    </div>
  );
}

function Grupo<T>({
  titulo,
  itens,
  children,
}: {
  titulo: string;
  itens: T[];
  children: (item: T) => React.ReactNode;
}) {
  if (itens.length === 0) return null;

  return (
    <section className="mb-1">
      <p className="px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground">
        {titulo}
      </p>
      {itens.map((item) => children(item))}
    </section>
  );
}

function Linha({
  icone,
  titulo,
  legenda,
  extra,
  onClick,
}: {
  icone: React.ReactNode;
  titulo: string;
  legenda?: string;
  extra?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/60 focus-visible:bg-accent"
    >
      <span className="shrink-0 text-muted-foreground">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate leading-snug">{titulo}</span>
        {legenda && (
          <span className="block truncate text-xs text-muted-foreground">
            {legenda}
          </span>
        )}
      </span>
      {extra}
    </button>
  );
}

/** Reexportado para quem precisa do tipo do resultado. */
export type { ResultadoDaBusca };
