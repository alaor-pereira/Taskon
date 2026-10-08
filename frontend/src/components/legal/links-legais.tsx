import Link from "next/link";
import { DOCUMENTOS } from "@/lib/legal/constantes";
import { cn } from "@/lib/utils";

/**
 * Os três documentos legais em linha, separados por "·". Abrem em nova aba
 * para não perder o que está preenchido na tela (cadastro, login, diálogo).
 */
export function LinksLegais({ className }: { className?: string }) {
  return (
    <nav aria-label="Documentos legais" className={cn("text-xs text-muted-foreground", className)}>
      <ul className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {DOCUMENTOS.map((doc, i) => (
          <li key={doc.href} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>·</span>}
            <Link
              href={doc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {doc.titulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
