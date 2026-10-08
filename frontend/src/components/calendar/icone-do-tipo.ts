import { Clock01Icon, Video01Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@/components/ui/icone";
import type { TipoDeEvento } from "@/lib/types";

/** O ícone de cada tipo de evento, igual na Agenda e na barra lateral. */
export const ICONE_DO_TIPO: Record<TipoDeEvento, IconSvgElement> = {
  REUNIAO: Video01Icon,
  ATIVIDADE: Clock01Icon,
};
