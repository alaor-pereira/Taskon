"use client";

import { GridViewIcon, KanbanIcon, LeftToRightListBulletIcon } from "@hugeicons/core-free-icons";
import { Icone, type IconSvgElement } from "@/components/ui/icone";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { t } from "@/lib/messages";
import type { Visualizacao } from "@/lib/types";
import { cn } from "@/lib/utils";

const VISUALIZACOES: Array<{
  id: Visualizacao;
  rotulo: string;
  icone: IconSvgElement;
}> = [
  { id: "CARDS", rotulo: t.visualizacao.cards, icone: GridViewIcon },
  { id: "KANBAN", rotulo: t.visualizacao.kanban, icone: KanbanIcon },
  { id: "LISTA", rotulo: t.visualizacao.lista, icone: LeftToRightListBulletIcon },
];

/** Cards, Kanban ou Lista — puramente apresentacional, sem opinião de onde o valor mora. */
export function ViewSwitcher({
  value,
  onChange,
}: {
  value: Visualizacao;
  onChange: (v: Visualizacao) => void;
}) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-md border p-0.5"
      role="group"
      aria-label={t.visualizacao.rotulo}
    >
      {VISUALIZACOES.map(({ id, rotulo, icone }) => (
        <Tooltip key={id}>
          <TooltipTrigger
            type="button"
            onClick={() => onChange(id)}
            aria-label={rotulo}
            aria-pressed={value === id}
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-full transition-colors",
              value === id
                ? "text-link"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icone icon={icone} className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="bottom">{rotulo}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
