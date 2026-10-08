"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";

function LinkDoDocumento({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-foreground underline underline-offset-4 decoration-foreground/30 transition-colors hover:decoration-foreground"
    >
      {children}
    </Link>
  );
}

/**
 * Caixa de aceite dos Termos de uso e de ciência da Política de privacidade.
 * Os links abrem em nova aba para não perder o que já foi preenchido.
 */
export function CampoDeAceite({
  marcado,
  aoMudar,
  desabilitado,
}: {
  marcado: boolean;
  aoMudar: (marcado: boolean) => void;
  desabilitado?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-5 text-muted-foreground has-data-disabled:cursor-not-allowed">
      <Checkbox
        name="aceite"
        checked={marcado}
        onCheckedChange={(valor) => aoMudar(valor === true)}
        disabled={desabilitado}
        required
        className="mt-0.5"
      />
      <span>
        Li e concordo com os <LinkDoDocumento href="/termos">Termos de uso</LinkDoDocumento> e
        declaro estar ciente da{" "}
        <LinkDoDocumento href="/privacidade">Política de privacidade</LinkDoDocumento>.
      </span>
    </label>
  );
}
