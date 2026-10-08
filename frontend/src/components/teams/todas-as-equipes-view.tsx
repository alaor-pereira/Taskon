"use client";

import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { toast } from "sonner";
import { abrirEquipeEm } from "@/components/layout/areas/abrir";
import { ItemAcoesMenu } from "@/components/layout/areas/item-acoes-menu";
import { SeletorSegmentado } from "@/components/seletor-segmentado";
import { useAbas } from "@/components/tabs/tabs-context";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/messages";
import { useEquipes, useExcluirEquipe } from "@/lib/queries/teams";
import type { Equipe } from "@/lib/types";
import { ConfirmarExclusaoDeEquipe } from "./confirmar-exclusao-de-equipe";
import { CriarEquipeDialog } from "./criar-equipe-dialog";
import { EditarEquipeDialog } from "./editar-equipe-dialog";

type Filtro = "TODAS" | "ADMINISTRO" | "PARTICIPO";

const FILTROS: Array<{ valor: Filtro; rotulo: string }> = [
  { valor: "TODAS", rotulo: "Todas" },
  { valor: "ADMINISTRO", rotulo: "Que administro" },
  { valor: "PARTICIPO", rotulo: "Que participo" },
];

interface EquipeComPapel {
  equipe: Equipe;
  administro: boolean;
}

/**
 * Página de Equipes, aberta pelo ícone da barra lateral: todas as equipes do
 * usuário em cartões, filtráveis entre as que ele administra (dono ou Gestor)
 * e as de que só participa. Editar e excluir só aparecem para quem administra.
 */
export function TodasAsEquipesView() {
  const { data, isPending } = useEquipes();
  const { abrirAba } = useAbas();
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Equipe | null>(null);
  const excluir = useExcluirEquipe();

  const equipes: EquipeComPapel[] = [
    ...(filtro !== "PARTICIPO"
      ? (data?.administro ?? []).map((equipe) => ({ equipe, administro: true }))
      : []),
    ...(filtro !== "ADMINISTRO"
      ? (data?.participo ?? []).map((equipe) => ({ equipe, administro: false }))
      : []),
  ].sort((a, b) => a.equipe.name.localeCompare(b.equipe.name, "pt-BR"));

  const [confirmando, setConfirmando] = useState<Equipe | null>(null);

  function excluirEquipe(equipe: Equipe) {
    setConfirmando(equipe);
  }

  async function confirmarExclusao(equipe: Equipe) {
    try {
      await excluir.mutateAsync(equipe.id);
      toast.success("Equipe excluída.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-6 pt-5 pb-3">
        <h1 className="heading-section flex-1">{t.paginas.equipes}</h1>

        <SeletorSegmentado
          opcoes={FILTROS}
          valor={filtro}
          aoMudar={setFiltro}
          rotulo="Filtrar equipes"
        />

        <Button onClick={() => setCriando(true)}>{t.acoes.novaEquipe}</Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
        {isPending ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : equipes.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {filtro === "TODAS" ? t.vazio.semEquipes : t.vazio.semEquipesNoFiltro}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {equipes.map(({ equipe, administro }) => (
              <CartaoDeEquipe
                key={equipe.id}
                equipe={equipe}
                administro={administro}
                aoAbrir={() => abrirEquipeEm(abrirAba, equipe)}
                aoEditar={() => setEditando(equipe)}
                aoExcluir={() => excluirEquipe(equipe)}
              />
            ))}
          </div>
        )}
      </div>

      <CriarEquipeDialog
        aberto={criando}
        aoFechar={() => setCriando(false)}
        aoCriar={(equipe) => abrirEquipeEm(abrirAba, equipe)}
      />

      <EditarEquipeDialog
        aberto={Boolean(editando)}
        aoFechar={() => setEditando(null)}
        equipe={editando}
      />

      <ConfirmarExclusaoDeEquipe
        equipe={confirmando}
        aoConfirmar={confirmarExclusao}
        aoFechar={() => setConfirmando(null)}
      />
    </div>
  );
}

/**
 * Cartão no molde do ProjectCard. O menu fica fora do botão principal —
 * botão dentro de botão não é HTML válido nem acessível.
 */
function CartaoDeEquipe({
  equipe,
  administro,
  aoAbrir,
  aoEditar,
  aoExcluir,
}: {
  equipe: Equipe;
  administro: boolean;
  aoAbrir: () => void;
  aoEditar: () => void;
  aoExcluir: () => void;
}) {
  const membros = equipe._count?.members;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={aoAbrir}
        className="flex h-full w-full flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:border-ring/40 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
      >
        <p className="line-clamp-2 pr-6 text-sm leading-snug font-semibold">
          {equipe.name}
        </p>
        {equipe.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{equipe.description}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
          <span>{administro ? "Você administra" : "Você participa"}</span>
          {membros !== undefined && (
            <span className="ml-auto inline-flex items-center gap-1">
              <Icone icon={UserGroupIcon} className="size-3.5" aria-hidden />
              {membros} {membros === 1 ? "membro" : "membros"}
            </span>
          )}
        </div>
      </button>

      {administro && (
        <div className="absolute top-3 right-3">
          <ItemAcoesMenu rotulo={equipe.name} onEditar={aoEditar} onExcluir={aoExcluir} />
        </div>
      )}
    </div>
  );
}
