"use client";

import { ConfirmarDialog } from "@/components/confirmar-dialog";
import type { Equipe } from "@/lib/types";

/** Confirmação de excluir equipe — a mesma na barra lateral e na página. */
export function ConfirmarExclusaoDeEquipe({
  equipe,
  aoConfirmar,
  aoFechar,
}: {
  equipe: Equipe | null;
  aoConfirmar: (equipe: Equipe) => void;
  aoFechar: () => void;
}) {
  return (
    <ConfirmarDialog
      aberto={Boolean(equipe)}
      titulo={`Excluir a equipe “${equipe?.name ?? ""}” definitivamente?`}
      descricao="A equipe deixa de existir para todos os membros."
      rotuloConfirmar="Excluir equipe"
      aoConfirmar={() => equipe && aoConfirmar(equipe)}
      aoFechar={aoFechar}
    />
  );
}
