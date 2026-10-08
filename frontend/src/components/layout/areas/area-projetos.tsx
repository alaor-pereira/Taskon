"use client";

import { Layers01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useExcluirProjetoComConfirmacao } from "@/components/confirmar-exclusao";
import { EditarProjetoDialog } from "@/components/projects/editar-projeto-dialog";
import { useAbas, type Aba } from "@/components/tabs/tabs-context";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/messages";
import { useProjetos } from "@/lib/queries/projects";
import type { Projeto } from "@/lib/types";
import {
  SidebarEsqueleto,
  SidebarItem,
  SidebarSection,
  SidebarVazio,
} from "../sidebar-section";
import { abrirProjetoEm } from "./abrir";
import { ItemAcoesMenu } from "./item-acoes-menu";

/**
 * Projetos: "Meus Projetos" (pessoais) e "Projetos em Equipe" (qualquer
 * projeto de equipe que o usuário enxerga, não importa quem é o dono).
 *
 * A Caixa de entrada não aparece aqui — mora na Home.
 */
export function AreaProjetos() {
  const { data, isPending } = useProjetos();
  const { abrirAba, abaAtivaId } = useAbas();
  const [editando, setEditando] = useState<Projeto | null>(null);
  const exclusao = useExcluirProjetoComConfirmacao();

  return (
    <>
      <SidebarSection titulo={t.secoes.meusProjetos}>
        <ListaDeProjetos
          projetos={data?.meus}
          carregando={isPending}
          vazio={t.vazio.semProjetos}
          abrirAba={abrirAba}
          abaAtivaId={abaAtivaId}
          aoEditar={setEditando}
          aoExcluir={exclusao.pedir}
        />
      </SidebarSection>

      <SidebarSection titulo={t.secoes.projetosQueParticipo}>
        <ListaDeProjetos
          projetos={data?.participo}
          carregando={isPending}
          vazio={t.vazio.semProjetos}
          abrirAba={abrirAba}
          abaAtivaId={abaAtivaId}
          aoEditar={setEditando}
          aoExcluir={exclusao.pedir}
        />
      </SidebarSection>

      <EditarProjetoDialog
        aberto={Boolean(editando)}
        aoFechar={() => setEditando(null)}
        projeto={editando}
      />

      {exclusao.dialogo}
    </>
  );
}

function ListaDeProjetos({
  projetos,
  carregando,
  vazio,
  abrirAba,
  abaAtivaId,
  aoEditar,
  aoExcluir,
}: {
  projetos: Projeto[] | undefined;
  carregando: boolean;
  vazio: string;
  abrirAba: (aba: Aba) => void;
  abaAtivaId: string | null;
  aoEditar: (projeto: Projeto) => void;
  aoExcluir: (projeto: Projeto) => void;
}) {
  if (carregando) return <SidebarEsqueleto linhas={3} />;
  if (!projetos || projetos.length === 0) return <SidebarVazio mensagem={vazio} />;

  return (
    <>
      {projetos.map((projeto) => (
        <SidebarItem
          key={projeto.id}
          icone={<Icone icon={Layers01Icon} className="size-4" />}
          titulo={projeto.name}
          legenda={projeto.team?.name}
          detalhe={projeto._count ? String(projeto._count.tasks) : undefined}
          ativo={abaAtivaId === `projeto:${projeto.id}`}
          onClick={() => abrirProjetoEm(abrirAba, projeto)}
          acoes={
            <ItemAcoesMenu
              rotulo={projeto.name}
              onEditar={() => aoEditar(projeto)}
              onExcluir={() => aoExcluir(projeto)}
            />
          }
        />
      ))}
    </>
  );
}
