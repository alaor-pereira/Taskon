import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";

export type { IconSvgElement } from "@hugeicons/react";

/** Ícone padrão do sistema: Hugeicons stroke rounded com traço 2. */
export function Icone({ strokeWidth = 2, ...props }: HugeiconsIconProps) {
  return <HugeiconsIcon strokeWidth={strokeWidth} {...props} />;
}
