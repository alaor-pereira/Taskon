"use client";

import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { toast } from "sonner";
import { useAbas, type Aba } from "@/components/tabs/tabs-context";
import { ConfirmarExclusaoDeEquipe } from "@/components/teams/confirmar-exclusao-de-equipe";
import { EditarEquipeDialog } from "@/components/teams/editar-equipe-dialog";
import { Icone } from "@/components/ui/icone";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/messages";
import { useEquipes, useExcluirEquipe } from "@/lib/queries/teams";
import type { Equipe } from "@/lib/types";
import {
  SidebarEsqueleto,
  SidebarItem,
  SidebarSection,
  SidebarVazio,
} from "../sidebar-section";
import { abrirEquipeEm } from "./abrir";
import { ItemAcoesMenu } from "./item-acoes-menu";

/**
 * Equipes: "que Administro" (dono ou Gestor) e "que Participo".
 * Uma equipe nunca aparece nas duas seções.
 */
export function AreaEquipes() {
  const { data, isPending } = useEquipes();
  const { abrirAba, abaAtivaId } = useAbas();
  const [editando, setEditando] = useState<Equipe | null>(null);
  const excluir = useExcluirEquipe();

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
    <>
      <SidebarSection titulo={t.secoes.equipesQueAdministro}>
        <ListaDeEquipes
          equipes={data?.administro}
          carregando={isPending}
          vazio={t.vazio.semEquipesQueAdministro}
          abrirAba={abrirAba}
          abaAtivaId={abaAtivaId}
          aoEditar={setEditando}
          aoExcluir={excluirEquipe}
        />
      </SidebarSection>

      <SidebarSection titulo={t.secoes.equipesQueParticipo}>
        <ListaDeEquipes
          equipes={data?.participo}
          carregando={isPending}
          vazio={t.vazio.semEquipes}
          abrirAba={abrirAba}
          abaAtivaId={abaAtivaId}
          aoEditar={setEditando}
          aoExcluir={excluirEquipe}
        />
      </SidebarSection>

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
    </>
  );
}

function ListaDeEquipes({
  equipes,
  carregando,
  vazio,
  abrirAba,
  abaAtivaId,
  aoEditar,
  aoExcluir,
}: {
  equipes: Equipe[] | undefined;
  carregando: boolean;
  vazio: string;
  abrirAba: (aba: Aba) => void;
  abaAtivaId: string | null;
  aoEditar: (equipe: Equipe) => void;
  aoExcluir: (equipe: Equipe) => void;
}) {
  if (carregando) return <SidebarEsqueleto linhas={2} />;
  if (!equipes || equipes.length === 0) return <SidebarVazio mensagem={vazio} />;

  return (
    <>
      {equipes.map((equipe) => (
        <SidebarItem
          key={equipe.id}
          icone={<Icone icon={UserGroupIcon} className="size-4" />}
          titulo={equipe.name}
          detalhe={equipe._count ? String(equipe._count.members) : undefined}
          ativo={abaAtivaId === `equipe:${equipe.id}`}
          onClick={() => abrirEquipeEm(abrirAba, equipe)}
          acoes={
            <ItemAcoesMenu
              rotulo={equipe.name}
              onEditar={() => aoEditar(equipe)}
              onExcluir={() => aoExcluir(equipe)}
            />
          }
        />
      ))}
    </>
  );
}
