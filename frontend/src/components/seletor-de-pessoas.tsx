"use client";

import {
  Cancel01Icon,
  PlusSignIcon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import { iniciais } from "@/components/tasks/task-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icone } from "@/components/ui/icone";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { UsuarioResumo } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Para a busca: sem acento e sem caixa ("João" acha "joao"). */
function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Escolha de pessoas (responsáveis de tarefa, participantes de reunião).
 *
 *   [(A) Ana ✕] [(J) João ✕]  (+)
 *
 * Só os escolhidos aparecem, cada um com ✕ para tirar. O + no fim abre a
 * lista de pessoas com busca: clicar marca ou desmarca, e a lista fica aberta
 * para escolher várias de uma vez. Desabilitado (somente leitura), sobram os
 * chips, sem ✕ e sem +.
 */
export function SeletorDePessoas({
  pessoas,
  selecionados,
  aoMudar,
  desabilitado = false,
  rotuloAdicionar,
  vazio,
}: {
  pessoas: UsuarioResumo[];
  selecionados: string[];
  aoMudar: (ids: string[]) => void;
  desabilitado?: boolean;
  /** Rótulo acessível do +, ex.: "Adicionar responsável". */
  rotuloAdicionar: string;
  /** Texto quando ninguém foi escolhido, ex.: "Ninguém". */
  vazio: string;
}) {
  const [busca, setBusca] = useState("");

  const escolhidas = selecionados
    .map((id) => pessoas.find((p) => p.id === id))
    .filter((p): p is UsuarioResumo => Boolean(p));

  const termo = normalizar(busca.trim());
  const encontradas = [...pessoas]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .filter(
      (p) => !termo || normalizar(p.name).includes(termo) || normalizar(p.email ?? "").includes(termo),
    );

  function alternar(id: string) {
    aoMudar(
      selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id],
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {escolhidas.length === 0 && (
        <span className="text-xs text-muted-foreground">{vazio}</span>
      )}

      {escolhidas.map((pessoa) => (
        <span
          key={pessoa.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/40 py-0.5 pl-0.5 text-xs data-[leitura=true]:pr-2.5"
          data-leitura={desabilitado}
        >
          <AvatarDaPessoa pessoa={pessoa} />
          <span className="max-w-28 truncate" title={pessoa.name}>
            {pessoa.name}
          </span>
          {!desabilitado && (
            <button
              type="button"
              onClick={() => alternar(pessoa.id)}
              aria-label={`Remover ${pessoa.name}`}
              className="mr-0.5 inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icone icon={Cancel01Icon} className="size-3" />
            </button>
          )}
        </span>
      ))}

      {!desabilitado && (
        <Popover onOpenChange={(aberto) => !aberto && setBusca("")}>
          <PopoverTrigger
            type="button"
            aria-label={rotuloAdicionar}
            title={rotuloAdicionar}
            className="inline-flex size-7 items-center justify-center rounded-full border border-dashed text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
          >
            <Icone icon={PlusSignIcon} className="size-4" />
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-64 gap-0 p-0">
            <label className="flex items-center gap-2 border-b px-3">
              <Icone icon={Search01Icon} className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar pessoa"
                aria-label="Buscar pessoa"
                autoFocus
                className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <ul className="max-h-60 overflow-y-auto p-1">
              {encontradas.length === 0 && (
                <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                  Ninguém encontrado
                </li>
              )}
              {encontradas.map((pessoa) => {
                const marcada = selecionados.includes(pessoa.id);
                return (
                  <li key={pessoa.id}>
                    <button
                      type="button"
                      onClick={() => alternar(pessoa.id)}
                      aria-pressed={marcada}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <AvatarDaPessoa pessoa={pessoa} />
                      <span className="min-w-0 flex-1 truncate">{pessoa.name}</span>
                      <Icone
                        icon={Tick02Icon}
                        className={cn("size-4 shrink-0", !marcada && "invisible")}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function AvatarDaPessoa({ pessoa }: { pessoa: UsuarioResumo }) {
  return (
    <Avatar className="size-5">
      {pessoa.image && <AvatarImage src={pessoa.image} alt="" />}
      <AvatarFallback className="text-[9px]">{iniciais(pessoa.name)}</AvatarFallback>
    </Avatar>
  );
}
