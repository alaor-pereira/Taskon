import type { Aba } from "@/components/tabs/tabs-context";
import { t } from "@/lib/messages";
import type { AreaId } from "@/lib/nav";
import type { Equipe, Projeto, Tarefa } from "@/lib/types";

/**
 * Identidade das abas.
 *
 * O prefixo por tipo evita que um projeto e uma tarefa com o mesmo id abram a
 * mesma aba, e permite reconhecer o recurso ao restaurar do localStorage.
 */

export const abrirTarefaEm = (
  abrirAba: (aba: Aba) => void,
  tarefa: Pick<Tarefa, "id" | "title">,
) =>
  abrirAba({
    id: `tarefa:${tarefa.id}`,
    tipo: "tarefa",
    titulo: tarefa.title,
    recursoId: tarefa.id,
  });

export const abrirProjetoEm = (
  abrirAba: (aba: Aba) => void,
  projeto: Pick<Projeto, "id" | "name">,
) =>
  abrirAba({
    id: `projeto:${projeto.id}`,
    tipo: "projeto",
    titulo: projeto.name,
    recursoId: projeto.id,
  });

export const abrirEquipeEm = (
  abrirAba: (aba: Aba) => void,
  equipe: Pick<Equipe, "id" | "name">,
) =>
  abrirAba({
    id: `equipe:${equipe.id}`,
    tipo: "equipe",
    titulo: equipe.name,
    recursoId: equipe.id,
  });

/**
 * Aba de listagem ampla. Os ids (`lista:todos-projetos` etc.) já estão
 * salvos no localStorage de quem usa o sistema: mudar um deles deixaria abas
 * restauradas apontando para lugar nenhum.
 */
export const abrirListaEm = (
  abrirAba: (aba: Aba) => void,
  id: string,
  titulo: string,
) => abrirAba({ id: `lista:${id}`, tipo: "lista", titulo, recursoId: id });

/** Aba única do calendário completo. */
export const abrirAgendaEm = (abrirAba: (aba: Aba) => void) =>
  abrirAba({ id: "agenda", tipo: "agenda", titulo: t.paginas.agenda });

/** A Lixeira sai do menu da conta (rodapé), não de um ícone de área. O id
 * `lista:lixeira` é o mesmo de antes, para abas já salvas continuarem valendo. */
export const abrirLixeiraEm = (abrirAba: (aba: Aba) => void) =>
  abrirListaEm(abrirAba, "lixeira", t.paginas.lixeira);

export const abrirPerfilEm = (abrirAba: (aba: Aba) => void) =>
  abrirAba({ id: "perfil", tipo: "perfil", titulo: t.paginas.perfil });

export const abrirConfiguracoesEm = (abrirAba: (aba: Aba) => void) =>
  abrirAba({ id: "configuracoes", tipo: "configuracoes", titulo: t.paginas.configuracoes });

export const abrirDashboardEm = (abrirAba: (aba: Aba) => void) =>
  abrirAba({ id: "dashboard", tipo: "dashboard", titulo: t.secoes.dashboard });

/**
 * A página de cada ícone da barra lateral. Cada uma tem uma aba só: clicar
 * de novo no ícone foca a aba existente em vez de abrir outra.
 */
export function abrirPaginaDaArea(abrirAba: (aba: Aba) => void, area: AreaId) {
  switch (area) {
    case "home":
      return abrirDashboardEm(abrirAba);
    case "equipes":
      return abrirListaEm(abrirAba, "equipes", t.paginas.equipes);
    case "projetos":
      return abrirListaEm(abrirAba, "todos-projetos", t.paginas.todosProjetos);
    case "tarefas":
      return abrirListaEm(abrirAba, "todas-tarefas", t.paginas.todasTarefas);
    case "agenda":
      return abrirAgendaEm(abrirAba);
  }
}
