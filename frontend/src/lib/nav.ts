import {
  Calendar03Icon,
  Home01Icon,
  Layers01Icon,
  Task01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { t } from "./messages";

/**
 * As cinco áreas da barra lateral. Clicar no ícone troca as seções exibidas
 * logo abaixo e abre (ou foca) a página da área numa aba — ver
 * `abrirPaginaDaArea`.
 */
export type AreaId =
  | "home"
  | "equipes"
  | "projetos"
  | "tarefas"
  | "agenda";

export interface Area {
  id: AreaId;
  rotulo: string;
  icone: IconSvgElement;
}

export const AREAS: readonly Area[] = [
  { id: "home", rotulo: t.nav.home, icone: Home01Icon },
  { id: "equipes", rotulo: t.nav.equipes, icone: UserGroupIcon },
  { id: "projetos", rotulo: t.nav.projetos, icone: Layers01Icon },
  { id: "tarefas", rotulo: t.nav.tarefas, icone: Task01Icon },
  { id: "agenda", rotulo: t.nav.agenda, icone: Calendar03Icon },
] as const;

/** Limite de itens por seção, conforme o prompt original. */
export const LIMITE_SECAO = 15;
/** "Recentes" mostra 5, não 15. */
export const LIMITE_RECENTES = 5;
