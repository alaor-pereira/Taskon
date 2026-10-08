"use client";

import {
  ArrowRight01Icon,
  CookieIcon,
  Delete02Icon,
  File01Icon,
  InformationCircleIcon,
  Logout03Icon,
  Settings02Icon,
  Shield01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useState } from "react";
import {
  abrirConfiguracoesEm,
  abrirLixeiraEm,
  abrirPerfilEm,
} from "@/components/layout/areas/abrir";
import { useSair } from "@/components/layout/use-sair";
import { NotificationsPopover } from "@/components/notifications/notifications-popover";
import { useAbas } from "@/components/tabs/tabs-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icone, type IconSvgElement } from "@/components/ui/icone";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/lib/auth-client";
import { DOCUMENTOS } from "@/lib/legal/constantes";
import { t } from "@/lib/messages";
import { cn } from "@/lib/utils";

/**
 * Rodapé fixo da barra lateral: o menu da conta (avatar, nome e e-mail) e as
 * notificações.
 *
 * O prompt é explícito: este bloco não pode se mover durante a rolagem das
 * seções. Por isso ele fica fora da área rolável, e não apenas "grudado" nela.
 */
export function UserFooter({
  recolhida,
  aoNavegar,
}: {
  recolhida: boolean;
  /** No celular, escolher um item fecha a gaveta. */
  aoNavegar?: () => void;
}) {
  const { data, isPending } = useSession();
  const { abrirAba } = useAbas();
  const sair = useSair();
  const [menuAberto, setMenuAberto] = useState(false);

  const usuario = data?.user;

  /** Fecha o menu e, no celular, a gaveta. */
  function fecharMenu() {
    setMenuAberto(false);
    aoNavegar?.();
  }

  /** Abre a página escolhida e fecha o menu. */
  function ir(abrir: () => void) {
    abrir();
    fecharMenu();
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 px-2 py-2">
        <div className="size-7 animate-pulse rounded-full bg-muted" />
        {!recolhida && (
          <div className="flex-1 space-y-1">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-32 animate-pulse rounded bg-muted" />
          </div>
        )}
      </div>
    );
  }

  if (!usuario) return null;

  const iniciais = usuario.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-2",
        recolhida && "flex-col gap-1.5 px-1",
      )}
    >
      <Popover open={menuAberto} onOpenChange={setMenuAberto}>
        <PopoverTrigger
          type="button"
          aria-label={`Menu da conta de ${usuario.name}`}
          data-tour="conta"
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-lg p-1 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring data-popup-open:bg-muted",
            !recolhida && "flex-1",
          )}
        >
          <Avatar className="size-7 shrink-0">
            {usuario.image && <AvatarImage src={usuario.image} alt="" />}
            <AvatarFallback className="text-[11px]">{iniciais || "?"}</AvatarFallback>
          </Avatar>
          {!recolhida && (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold">{usuario.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {usuario.email}
              </span>
            </span>
          )}
        </PopoverTrigger>

        <PopoverContent
          side={recolhida ? "right" : "top"}
          align={recolhida ? "end" : "start"}
          className="w-56 gap-0 p-1"
        >
          <ItemDoMenu
            icone={UserCircleIcon}
            rotulo={t.paginas.perfil}
            onClick={() => ir(() => abrirPerfilEm(abrirAba))}
          />
          <ItemDoMenu
            icone={Settings02Icon}
            rotulo={t.paginas.configuracoes}
            onClick={() => ir(() => abrirConfiguracoesEm(abrirAba))}
          />
          <SaibaMais aoEscolher={fecharMenu} />
          <ItemDoMenu
            icone={Delete02Icon}
            rotulo={t.paginas.lixeira}
            onClick={() => ir(() => abrirLixeiraEm(abrirAba))}
          />
          <Separator className="my-1" />
          <ItemDoMenu icone={Logout03Icon} rotulo={t.nav.sair} onClick={sair} />
        </PopoverContent>
      </Popover>

      <NotificationsPopover recolhida={recolhida} />
    </div>
  );
}

const CLASSES_DO_ITEM =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none";

function ItemDoMenu({
  icone,
  rotulo,
  onClick,
}: {
  icone: IconSvgElement;
  rotulo: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={CLASSES_DO_ITEM}>
      <Icone icon={icone} className="size-4 text-muted-foreground" />
      {rotulo}
    </button>
  );
}

const ICONES_DOS_DOCUMENTOS: Record<(typeof DOCUMENTOS)[number]["href"], IconSvgElement> = {
  "/privacidade": Shield01Icon,
  "/cookies": CookieIcon,
  "/termos": File01Icon,
};

/**
 * Submenu com os documentos legais. Abre ao passar o mouse e também no clique
 * ou toque, para funcionar no celular. Os documentos abrem em nova aba, para
 * não tirar a pessoa do que ela estava fazendo no app.
 */
function SaibaMais({ aoEscolher }: { aoEscolher: () => void }) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={80}
        closeDelay={120}
        className={cn(CLASSES_DO_ITEM, "data-popup-open:bg-accent data-popup-open:text-accent-foreground")}
      >
        <Icone icon={InformationCircleIcon} className="size-4 text-muted-foreground" />
        <span className="flex-1 text-left">{t.legal.saibaMais}</span>
        <Icone icon={ArrowRight01Icon} className="size-4 text-muted-foreground" aria-hidden />
      </PopoverTrigger>

      <PopoverContent side="right" align="start" sideOffset={6} className="w-56 gap-0 p-1">
        {DOCUMENTOS.map((doc) => (
          <Link
            key={doc.href}
            href={doc.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={aoEscolher}
            className={CLASSES_DO_ITEM}
          >
            <Icone icon={ICONES_DOS_DOCUMENTOS[doc.href]} className="size-4 text-muted-foreground" />
            {doc.titulo}
          </Link>
        ))}
      </PopoverContent>
    </Popover>
  );
}
