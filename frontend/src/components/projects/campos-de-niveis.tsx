"use client";

import {
  DifficultyBadge,
  ITENS_DE_DIFICULDADE,
  ITENS_DE_PRIORIDADE,
  PriorityBadge,
  SEM_DIFICULDADE,
} from "@/components/tasks/task-badges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/lib/messages";
import type { Dificuldade, Prioridade } from "@/lib/types";

const PRIORIDADES: Prioridade[] = ["ALTA", "MEDIA", "BAIXA"];
const DIFICULDADES: Dificuldade[] = ["ROTINEIRO", "COMPLEXO", "CRITICO"];

export interface NiveisDoProjeto {
  priority: Prioridade;
  difficulty: Dificuldade | null;
  /** AAAA-MM-DD, ou "" sem prazo. */
  dueDate: string;
}

/** Prioridade, dificuldade e prazo — os mesmos campos em criar e editar projeto. */
export function CamposDeNiveis({
  prefixo,
  valor,
  aoMudar,
  desabilitado,
}: {
  /** Prefixo dos ids, para os rótulos apontarem ao campo certo. */
  prefixo: string;
  valor: NiveisDoProjeto;
  aoMudar: (valor: NiveisDoProjeto) => void;
  desabilitado?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 *:min-w-0">
      <div className="space-y-2">
        <Label htmlFor={`${prefixo}-prioridade`}>Prioridade</Label>
        <Select
          value={valor.priority}
          onValueChange={(v) => aoMudar({ ...valor, priority: (v as Prioridade) ?? "MEDIA" })}
          items={ITENS_DE_PRIORIDADE}
          disabled={desabilitado}
        >
          <SelectTrigger id={`${prefixo}-prioridade`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORIDADES.map((p) => (
              <SelectItem key={p} value={p}>
                <PriorityBadge priority={p} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefixo}-dificuldade`}>Dificuldade</Label>
        <Select
          value={valor.difficulty ?? SEM_DIFICULDADE}
          onValueChange={(v) =>
            aoMudar({
              ...valor,
              difficulty: !v || v === SEM_DIFICULDADE ? null : (v as Dificuldade),
            })
          }
          items={ITENS_DE_DIFICULDADE}
          disabled={desabilitado}
        >
          <SelectTrigger id={`${prefixo}-dificuldade`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_DIFICULDADE}>{t.dificuldade.naoEstimada}</SelectItem>
            {DIFICULDADES.map((d) => (
              <SelectItem key={d} value={d}>
                <DifficultyBadge difficulty={d} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefixo}-prazo`}>Prazo</Label>
        {/* Data pura: o prazo não tem hora nem fuso. */}
        <Input
          id={`${prefixo}-prazo`}
          type="date"
          value={valor.dueDate}
          onChange={(e) => aoMudar({ ...valor, dueDate: e.target.value })}
          disabled={desabilitado}
        />
      </div>
    </div>
  );
}
