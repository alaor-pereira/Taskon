"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface OpcaoDeFiltro<V extends string> {
  valor: V;
  rotulo: string;
}

/**
 * Filtro em pílula: "Etapa: Todas ▾". O nome do filtro fica no gatilho, então
 * as opções podem ser curtas ("Alta", não "Prioridade alta").
 *
 * - A largura acompanha o texto; nada é cortado por largura fixa.
 * - Fora do valor padrão, a pílula ganha destaque: dá para ver de relance que
 *   há um filtro escondendo itens.
 * - A lista abre sempre abaixo do gatilho, alinhada à esquerda, sem inverter
 *   de lado; se faltar espaço, ela encolhe e rola por dentro. O padrão do
 *   Select (lista sobre o gatilho, rolada até o item escolhido) fazia a lista
 *   "subir" e punha as setas de rolagem por cima do texto.
 */
export function FiltroSelect<V extends string>({
  rotulo,
  valor,
  padrao,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: V;
  /** O valor "sem filtro"; fora dele a pílula fica destacada. */
  padrao: V;
  opcoes: ReadonlyArray<OpcaoDeFiltro<V>>;
  aoMudar: (valor: V) => void;
}) {
  const ativo = valor !== padrao;
  const rotuloDoValor = opcoes.find((o) => o.valor === valor)?.rotulo ?? "";

  return (
    <Select
      value={valor}
      onValueChange={(v) => aoMudar((v as V | null) ?? padrao)}
      // Sem `items`, o Base UI mostraria o valor cru ("NAO_ESTIMADA").
      items={Object.fromEntries(opcoes.map((o) => [o.valor, o.rotulo]))}
    >
      <SelectTrigger
        size="sm"
        aria-label={`Filtrar por ${rotulo.toLowerCase()}`}
        className={cn(
          "max-w-full gap-1 text-xs hover:bg-muted/60",
          ativo && "border-primary/40 bg-primary/5 hover:bg-primary/10 dark:bg-primary/10",
        )}
      >
        <span className="text-muted-foreground">{rotulo}:</span>
        <span className="min-w-0 max-w-48 truncate font-medium">{rotuloDoValor}</span>
      </SelectTrigger>
      <SelectContent
        side="bottom"
        align="start"
        alignItemWithTrigger={false}
        collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
        className="w-auto min-w-(--anchor-width)"
      >
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
