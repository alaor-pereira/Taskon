"use client";

import { MoreVerticalIcon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icone } from "@/components/ui/icone";

/**
 * Menu de três pontinhos dos itens da sidebar: Editar e Excluir — e, quando o
 * item tem um endereço (o link de uma reunião), uma primeira opção que o abre
 * numa nova aba do navegador.
 *
 * Some no lugar do contador ao passar o mouse — ver `SidebarItem`. Sem fundo
 * no hover/aberto, só cor, como todo ícone solto do sistema.
 */
export function ItemAcoesMenu({
  rotulo,
  onEditar,
  onExcluir,
  link,
}: {
  rotulo: string;
  onEditar: () => void;
  onExcluir: () => void;
  link?: { rotulo: string; href: string };
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label={`Opções: ${rotulo}`}
        className="relative inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors before:absolute before:-inset-3 before:content-[''] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
      >
        <Icone icon={MoreVerticalIcon} className="size-4" />
      </DropdownMenuTrigger>
      {/*
       * O foco só volta ao ⋮ quando o menu fecha pelo teclado. Fechando com o
       * mouse, o foco devolvido o deixaria visível (e por cima do detalhe)
       * mesmo sem o ponteiro no item.
       */}
      <DropdownMenuContent align="end" finalFocus={(tipo) => tipo === "keyboard"}>
        {link && (
          <DropdownMenuLinkItem href={link.href} target="_blank" rel="noopener noreferrer">
            {link.rotulo}
          </DropdownMenuLinkItem>
        )}
        <DropdownMenuItem onClick={onEditar}>Editar</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onExcluir}>
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
