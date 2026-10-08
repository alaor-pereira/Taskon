import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/*
 * Botões do design system: toda ação é um pill (radius-pill), o azul
 * primary é o único sinal de ação, e não há cor de hover — o DS não a
 * documenta. Pressionado = scale(0.95) (globals.css); foco = contorno 2px
 * primary-focus com 2px de afastamento; desabilitado = rótulo --disabled.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-normal whitespace-nowrap outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring disabled:pointer-events-none disabled:text-disabled aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* Pill azul: o CTA padrão. */
        default:
          "bg-primary text-primary-foreground disabled:bg-muted",
        /* Pill fantasma: anel de 1px e rótulo no azul de link (primary no
         * claro, primary-on-dark no escuro). O segundo de um par. */
        outline:
          "border-link bg-transparent text-link aria-expanded:bg-accent disabled:border-border",
        /* Botão utilitário escuro: retângulo radius-sm, button-utility. */
        secondary:
          "rounded-sm bg-secondary text-secondary-foreground disabled:bg-muted",
        ghost:
          "text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive dark:bg-destructive/20",
        link: "rounded-none px-0 text-link underline-offset-4 hover:underline",
        /* Cápsula pérola: radius-md com halo de 3px divider-soft. Ações
         * secundárias em cartões. */
        pearl:
          "rounded-md bg-pearl text-ink-muted ring-3 ring-divider-soft",
        /* Pill grande, button-large (18px, peso 300) — um por página. */
        hero:
          "h-12 px-7 text-[18px] leading-none font-light bg-primary text-primary-foreground disabled:bg-muted",
      },
      size: {
        default:
          "h-9 gap-1.5 px-[22px] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-7 gap-1 px-3.5 text-xs has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
        /* 11×22 com rótulo body (17px): a medida exata do DS. */
        lg: "h-11 gap-1.5 px-[22px] text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-7",
        /* size-touch: alvo mínimo de 44px. */
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
