"use client";

import type { AreaId } from "@/lib/nav";
import { AreaAgenda } from "./areas/area-agenda";
import { AreaEquipes } from "./areas/area-equipes";
import { AreaHome } from "./areas/area-home";
import { AreaProjetos } from "./areas/area-projetos";
import { AreaTarefas } from "./areas/area-tarefas";

/**
 * Seções exibidas para cada área da barra lateral, conforme o prompt original.
 *
 * Clicar num dos cinco ícones troca as seções mostradas aqui; a navegação de
 * conteúdo acontece por abas, no header.
 */
export function SidebarAreas({ area }: { area: AreaId }) {
  switch (area) {
    case "home":
      return <AreaHome />;
    case "equipes":
      return <AreaEquipes />;
    case "projetos":
      return <AreaProjetos />;
    case "tarefas":
      return <AreaTarefas />;
    case "agenda":
      return <AreaAgenda />;
  }
}
