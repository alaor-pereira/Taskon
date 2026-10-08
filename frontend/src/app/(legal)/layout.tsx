import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { LinksLegais } from "@/components/legal/links-legais";
import { NavLegal } from "@/components/legal/nav-legal";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";

/**
 * Documentos legais: públicos, sem exigir login, e iguais para quem está ou
 * não conectado. Ficam fora de (app), que é o único grupo que redireciona
 * para /entrar.
 */
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 surface-frost">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Taskon — página inicial" className="rounded-md">
            <Logo />
          </Link>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>
            Ir para o Taskon
            <Icone icon={ArrowRight01Icon} data-icon="inline-end" />
          </Button>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <NavLegal />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        {children}
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-6 sm:flex-row sm:justify-between sm:px-6">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Taskon</p>
          <LinksLegais />
        </div>
      </footer>
    </div>
  );
}
