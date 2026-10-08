"use client";

import {
  ArrowUpRight01Icon,
  CookieIcon,
  File01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSair } from "@/components/layout/use-sair";
import { Button } from "@/components/ui/button";
import { Icone, type IconSvgElement } from "@/components/ui/icone";
import { CHAVE_ACEITE_PENDENTE, DOCUMENTOS } from "@/lib/legal/constantes";
import { t } from "@/lib/messages";
import { useAceitarTermos, useSituacaoDosTermos } from "@/lib/queries/termos";
import { CampoDeAceite } from "./campo-de-aceite";

const ICONES: Record<(typeof DOCUMENTOS)[number]["href"], IconSvgElement> = {
  "/privacidade": Shield01Icon,
  "/cookies": CookieIcon,
  "/termos": File01Icon,
};

/** A marca de aceite deixada pelo /cadastrar antes do login social. */
function haAceitePendente(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_ACEITE_PENDENTE) === "1";
  } catch {
    return false;
  }
}

function descartarAceitePendente(): void {
  try {
    sessionStorage.removeItem(CHAVE_ACEITE_PENDENTE);
  } catch {
    // Sem sessionStorage, não havia marca.
  }
}

/**
 * Exige o aceite da versão vigente dos documentos legais antes de usar o app.
 *
 * Aparece para quem nunca aceitou (contas anteriores aos documentos, contas
 * criadas pelo Google/GitHub direto no /entrar) e para todos quando a versão
 * muda. Não fecha com Esc nem clicando fora: a saída é aceitar ou sair.
 */
export function AceiteDosTermos() {
  const sair = useSair();
  const { data: situacao } = useSituacaoDosTermos();
  const aceitar = useAceitarTermos();
  const registrarPendente = useAceitarTermos();
  const [marcado, setMarcado] = useState(false);

  // Quem marcou o aceite no /cadastrar e seguiu pelo login social volta para
  // cá já logado: o aceite é registrado sem perguntar de novo. A marca é de
  // uso único; a ref segura o efeito duplo do modo estrito.
  const [aceitePendente] = useState(haAceitePendente);
  const jaRegistrou = useRef(false);
  useEffect(() => {
    if (!aceitePendente || jaRegistrou.current) return;
    jaRegistrou.current = true;
    descartarAceitePendente();
    registrarPendente.mutate("CADASTRO");
  }, [aceitePendente, registrarPendente]);

  const aguardandoPendente =
    aceitePendente && (registrarPendente.isIdle || registrarPendente.isPending);
  const aberto = Boolean(situacao?.precisaAceitar) && !aguardandoPendente;

  function confirmar() {
    aceitar.mutate("REACEITE", {
      onError: () => toast.error(t.erros.generico),
    });
  }

  return (
    <AlertDialog open={aberto}>
      <AlertDialogContent className="data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Termos de uso e privacidade</AlertDialogTitle>
          <AlertDialogDescription>
            Para continuar usando o Taskon, leia e aceite os documentos abaixo. Eles explicam as
            regras do serviço e como tratamos seus dados.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="grid gap-1.5">
          {DOCUMENTOS.map((doc) => (
            <li key={doc.href}>
              <Link
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Icone icon={ICONES[doc.href]} className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1">{doc.titulo}</span>
                <Icone icon={ArrowUpRight01Icon} className="size-3.5 text-muted-foreground" aria-hidden />
                <span className="sr-only">(abre em nova aba)</span>
              </Link>
            </li>
          ))}
        </ul>

        <CampoDeAceite marcado={marcado} aoMudar={setMarcado} desabilitado={aceitar.isPending} />

        <AlertDialogFooter>
          <Button variant="ghost" onClick={sair} disabled={aceitar.isPending}>
            {t.nav.sair}
          </Button>
          <Button onClick={confirmar} disabled={!marcado || aceitar.isPending}>
            {aceitar.isPending ? "Registrando…" : "Aceitar e continuar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
