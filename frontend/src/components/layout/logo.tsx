import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logotipo do Taskon (SVGs em `public/taskon-logo-svg/`).
 *
 * Há duas variantes por tema: a de fundo claro tem o texto quase preto e some
 * no escuro; a de fundo escuro tem o texto claro e some no claro. A troca é
 * feita por CSS, e não por JavaScript, para o logo certo já vir na primeira
 * pintura, sem piscar durante a hidratação.
 *
 * O wordmark tem proporção 433.64×104 (horizontal); o símbolo "T", 64×102.
 */
const PASTA = "/taskon-logo-svg";

export function Logo({
  compacta = false,
  className,
}: {
  compacta?: boolean;
  className?: string;
}) {
  const altura = 20;
  const largura = compacta
    ? Math.round((altura * 64) / 102)
    : Math.round((altura * 433.64) / 104);
  const base = compacta
    ? `${PASTA}/simbolo/taskon-simbolo-T-cor`
    : `${PASTA}/wordmark/taskon-wordmark-cor`;

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center", className)}
      style={{ width: largura, height: altura }}
      aria-label="Taskon"
      role="img"
    >
      <Image
        src={`${base}-fundo-claro.svg`}
        alt=""
        width={largura}
        height={altura}
        priority
        unoptimized
        className="object-contain dark:hidden"
      />
      <Image
        src={`${base}-fundo-escuro.svg`}
        alt=""
        width={largura}
        height={altura}
        priority
        unoptimized
        className="hidden object-contain dark:block"
      />
    </span>
  );
}
