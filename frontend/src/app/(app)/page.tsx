"use client";

import { AgendaView } from "@/components/calendar/agenda-view";
import { ConfiguracoesView } from "@/components/configuracoes/configuracoes-view";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { PerfilView } from "@/components/perfil/perfil-view";
import { TodasAsEquipesView } from "@/components/teams/todas-as-equipes-view";
import { LixeiraView } from "@/components/trash/lixeira-view";
import { ProjectView } from "@/components/projects/project-view";
import { TodosOsProjetosView } from "@/components/projects/todos-os-projetos-view";
import { useAbas } from "@/components/tabs/tabs-context";
import { TaskView } from "@/components/tasks/task-view";
import { TodasAsTarefasView } from "@/components/tasks/todas-as-tarefas-view";
import { TeamView } from "@/components/teams/team-view";
import { t } from "@/lib/messages";

/**
 * Área de conteúdo. O que aparece depende da aba ativa, e não da rota:
 * o sistema mantém várias páginas abertas ao mesmo tempo.
 *
 * A `key` por recurso força a remontagem ao trocar de aba do mesmo tipo, para
 * que o estado local de uma página não vaze para outra.
 */
export default function Home() {
  const { abaAtiva, pronto } = useAbas();

  if (!pronto) return null;

  if (!abaAtiva) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          {t.vazio.semAbas}
        </p>
      </div>
    );
  }

  if (abaAtiva.tipo === "dashboard") {
    return <DashboardView />;
  }

  if (abaAtiva.tipo === "agenda") {
    return <AgendaView />;
  }

  if (abaAtiva.tipo === "perfil") {
    return <PerfilView />;
  }

  if (abaAtiva.tipo === "configuracoes") {
    return <ConfiguracoesView />;
  }

  if (abaAtiva.tipo === "lista") {
    if (abaAtiva.recursoId === "todos-projetos") {
      return <TodosOsProjetosView key={abaAtiva.id} />;
    }
    if (abaAtiva.recursoId === "todas-tarefas") {
      return <TodasAsTarefasView key={abaAtiva.id} />;
    }
    if (abaAtiva.recursoId === "equipes") {
      return <TodasAsEquipesView key={abaAtiva.id} />;
    }
    if (abaAtiva.recursoId === "lixeira") {
      return <LixeiraView key={abaAtiva.id} />;
    }
  }

  if (abaAtiva.recursoId) {
    switch (abaAtiva.tipo) {
      case "equipe":
        return <TeamView key={abaAtiva.id} teamId={abaAtiva.recursoId} />;
      case "projeto":
        return <ProjectView key={abaAtiva.id} projectId={abaAtiva.recursoId} />;
      case "tarefa":
        return <TaskView key={abaAtiva.id} taskId={abaAtiva.recursoId} />;
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold tracking-tight">{abaAtiva.titulo}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Esta área recebe o conteúdo da aba nas próximas fases.
      </p>
    </div>
  );
}
