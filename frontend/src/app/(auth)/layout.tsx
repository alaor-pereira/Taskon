import Image from "next/image";
import { LinksLegais } from "@/components/legal/links-legais";
import { Logo } from "@/components/layout/logo";

/**
 * Telas públicas de acesso: entrar, cadastrar e recuperar senha. Os documentos
 * legais ficam no pé da coluna do formulário, em todas elas.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <div className="flex min-w-0 flex-1 flex-col items-center px-4">
        <div className="flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          {/* No desktop o flyer já carrega a marca. */}
          <div className="mb-8 flex justify-center xl:hidden">
            <Logo />
          </div>
          {children}
        </div>

        <LinksLegais className="w-full max-w-sm pb-6" />
      </div>

      {/* Flyer de marketing, só no desktop. O contraste é invertido de
          propósito: flyer escuro no tema claro e vice-versa. As imagens ficam
          no carregamento lazy padrão, então a oculta (display: none) não é baixada. */}
      <aside
        aria-hidden
        className="sticky top-0 hidden aspect-4/5 h-dvh max-w-[50vw] shrink-0 overflow-hidden xl:block"
      >
        <Image
          src="/taskon-logo-svg/taskon-flyer-4x5-escuro.png"
          alt=""
          fill
          sizes="50vw"
          className="object-cover object-right dark:hidden"
        />
        <Image
          src="/taskon-logo-svg/taskon-flyer-4x5-claro.png"
          alt=""
          fill
          sizes="50vw"
          className="hidden object-cover object-right dark:block"
        />
      </aside>
    </div>
  );
}
