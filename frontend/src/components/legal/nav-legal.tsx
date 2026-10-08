"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCUMENTOS } from "@/lib/legal/constantes";
import { cn } from "@/lib/utils";

/** Abas entre os três documentos, no cabeçalho do layout legal. */
export function NavLegal() {
  const caminho = usePathname();

  return (
    <nav aria-label="Documentos legais" className="-mb-px overflow-x-auto">
      <ul className="flex gap-6">
        {DOCUMENTOS.map((doc) => {
          const ativo = caminho === doc.href;
          return (
            <li key={doc.href}>
              <Link
                href={doc.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "block border-b-2 py-3 text-sm whitespace-nowrap transition-colors",
                  ativo
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {doc.titulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
