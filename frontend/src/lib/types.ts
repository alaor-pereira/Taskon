/**
 * Tipos do domínio, espelhando o que a API devolve.
 *
 * São escritos à mão porque backend e frontend são projetos independentes e
 * não compartilham o cliente do Prisma. Quando um contrato mudar no backend,
 * este arquivo é o ponto onde a mudança precisa ser refletida.
 */

export type PapelEquipe = "GESTOR" | "MEMBRO" | "VISUALIZADOR";
export type PapelProjeto = "OWNER" | "EDITOR" | "VIEWER";

export type StatusTarefa =
  | "BACKLOG"
  | "A_FAZER"
  | "EM_ANDAMENTO"
  | "EM_REVISAO"
  | "EM_PAUSA"
  | "CONCLUIDO";

export type Prioridade = "ALTA" | "MEDIA" | "BAIXA";
/** Dificuldade estimada. Nula quando ninguém estimou. */
export type Dificuldade = "ROTINEIRO" | "COMPLEXO" | "CRITICO";
export type Visualizacao = "CARDS" | "KANBAN" | "LISTA";

export interface UsuarioResumo {
  id: string;
  name: string;
  /**
   * Só vem onde a tela mostra o e-mail (listas de membros de equipe e de
   * projeto). Autores, responsáveis e participantes chegam sem ele.
   */
  email?: string;
  image?: string | null;
}

/** Pessoa numa lista de membros, onde o e-mail aparece na tela. */
export type UsuarioComEmail = UsuarioResumo & { email: string };

/** Quem pode ser @mencionado: o apelido é o termo que o servidor reconhece. */
export interface Mencionavel {
  id: string;
  name: string;
  image?: string | null;
  apelido: string;
}

export interface Equipe {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { members: number; projects: number };
}

export interface MembroDaEquipe {
  id: string;
  role: PapelEquipe;
  createdAt: string;
  user: UsuarioComEmail;
}

export interface EquipesAgrupadas {
  administro: Equipe[];
  participo: Equipe[];
}

export interface DetalheDaEquipe {
  equipe: Equipe;
  membros: MembroDaEquipe[];
  meuPapel: PapelEquipe;
  souDono: boolean;
}

export interface ConviteRecebido {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  team: { id: string; name: string; description: string | null } | null;
  invitedBy: { id: string; name: string };
}

export interface ConvitePendente {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { id: string; name: string };
}

export interface Projeto {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  teamId: string | null;
  isInbox: boolean;
  status: StatusTarefa;
  priority: Prioridade;
  difficulty: Dificuldade | null;
  /** Data pura em ISO, sem hora. */
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  /** Quem alterou o próprio projeto por último — tarefas não contam. */
  updatedBy?: Pick<UsuarioResumo, "id" | "name" | "image"> | null;
  team?: { id: string; name: string } | null;
  /** Participantes, o dono primeiro. Vem na listagem completa de projetos. */
  members?: Array<{ role: PapelProjeto; user: UsuarioResumo }>;
  _count?: { tasks: number };
}

/** Projeto na página "Ver todos os projetos", já com o escopo calculado. */
export interface ProjetoComEscopo extends Projeto {
  escopo: "PESSOAL" | "EQUIPE";
}

export interface MembroDoProjeto {
  id: string;
  role: PapelProjeto;
  createdAt: string;
  user: UsuarioComEmail;
}

export interface ProjetosAgrupados {
  meus: Projeto[];
  participo: Projeto[];
  /** Permite decidir se o atalho "ver todos" faz sentido. */
  totais: { meus: number; participo: number };
  /** Projeto pessoal fixo do usuário; agora vive na Home, não nesta lista. */
  caixaDeEntrada: { id: string; name: string } | null;
}

export interface DetalheDoProjeto {
  projeto: Projeto;
  equipe: { id: string; name: string } | null;
  membros: MembroDoProjeto[];
  meuPapel: PapelProjeto;
  souDono: boolean;
  viaGestorDaEquipe: boolean;
}

export interface Tarefa {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  status: StatusTarefa;
  priority: Prioridade;
  difficulty: Dificuldade | null;
  /** Data pura em ISO, sem hora: o vencimento não depende de fuso. */
  dueDate: string | null;
  position: number;
  completedAt: string | null;
  /** Enviada de volta em toda gravação, para detectar alteração simultânea. */
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: UsuarioResumo;
  updatedBy: UsuarioResumo | null;
  assignees: Array<{ user: UsuarioResumo }>;
  _count: { subtasks: number };
}

export interface TarefaDetalhada extends Tarefa {
  subtasks: Tarefa[];
  parent: { id: string; title: string } | null;
}

export interface TarefaRecente {
  tarefa: Tarefa;
  alteradoPor: UsuarioResumo;
  alteradoEm: string;
  acao: string;
}

export interface ListaPorPrioridade {
  itens: Tarefa[];
  total: number;
}

export interface Comentario {
  id: string;
  taskId: string;
  bodyMd: string;
  /** Preenchido quando o texto foi alterado depois de publicado. */
  editedAt: string | null;
  createdAt: string;
  author: UsuarioResumo;
  mentions: Array<{ user: { id: string; name: string } }>;
}

export interface ItemDaLixeira {
  id: string;
  deletedAt: string;
  deletionBatchId: string | null;
}

export interface ProjetoExcluido extends ItemDaLixeira {
  name: string;
  team: { id: string; name: string } | null;
  _count: { tasks: number };
}

export interface TarefaExcluida extends ItemDaLixeira {
  title: string;
  status: StatusTarefa;
  priority: Prioridade;
  project: { id: string; name: string };
}

export interface ConteudoDaLixeira {
  projetos: ProjetoExcluido[];
  tarefas: TarefaExcluida[];
  totais: { projetos: number; tarefas: number };
  diasAteAPurga: number;
}

export interface SelecaoDaLixeira {
  projetos: string[];
  tarefas: string[];
}

export interface ResultadoDoLoteDaLixeira {
  projetos: string[];
  tarefas: string[];
  falhas: Array<{ tipo: "projeto" | "tarefa"; id: string; motivo: string }>;
}

export interface ResultadoDaBusca {
  termo: string;
  projetos: Array<{
    id: string;
    name: string;
    description: string | null;
    isInbox: boolean;
    team: { id: string; name: string } | null;
  }>;
  tarefas: Array<{
    id: string;
    title: string;
    description: string | null;
    status: StatusTarefa;
    priority: Prioridade;
    project: { id: string; name: string };
  }>;
  equipes: Array<{ id: string; name: string; description: string | null }>;
  total: number;
}

// --- Agenda ---------------------------------------------------------------

export type TipoDeEvento = "ATIVIDADE" | "REUNIAO";
export type RespostaDeParticipante = "PENDENTE" | "ACEITO" | "RECUSADO";
export type Frequencia = "DIARIA" | "SEMANAL" | "MENSAL" | "ANUAL";
export type EscopoDaAlteracao = "SO_ESTA" | "ESTA_E_SEGUINTES" | "TODAS";

export type Termino =
  | { tipo: "NUNCA" }
  | { tipo: "ATE"; data: string }
  | { tipo: "APOS"; ocorrencias: number };

export interface Recorrencia {
  frequencia: Frequencia;
  intervalo?: number;
  /** 0 = domingo … 6 = sábado. */
  diasDaSemana?: number[];
  termino?: Termino;
}

export interface Evento {
  id: string;
  kind: TipoDeEvento;
  ownerId: string;
  title: string;
  description: string | null;
  locationOrLink: string | null;
  /** Link do Google Meet, gerado pela agenda Google do organizador. */
  meetLink?: string | null;
  /** Vem só na resposta de criar/editar, quando o Meet não pôde ser gerado. */
  aviso?: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: string;
  /** Regra iCalendar. Nulo quando o evento não se repete. */
  rrule: string | null;
  taskId: string | null;
  projectId: string | null;
  owner: { id: string; name: string; image?: string | null };
  participants: Array<{
    response: RespostaDeParticipante;
    user: UsuarioResumo;
  }>;
  task: { id: string; title: string; projectId: string } | null;
  project: { id: string; name: string } | null;
}

/**
 * Uma ocorrência de um evento.
 *
 * As ocorrências de séries recorrentes não existem no banco: são calculadas a
 * cada consulta. `inicioOriginal` é a chave que identifica a ocorrência na
 * série, mesmo quando ela foi movida.
 */
export interface OcorrenciaDeAgenda {
  inicio: string;
  fim: string;
  inicioOriginal: string;
  modificada: boolean;
  evento: Evento;
}

export type TipoNotificacao =
  | "CONVITE_EQUIPE"
  | "CONVITE_PROJETO"
  | "TAREFA_ATRIBUIDA"
  | "MENCAO_COMENTARIO"
  | "REUNIAO_AGENDADA"
  | "TAREFA_VENCENDO"
  | "TAREFA_DESATRIBUIDA"
  | "TAREFA_ATRASADA"
  | "COMENTARIO_NA_TAREFA"
  | "REUNIAO_ALTERADA"
  | "REUNIAO_CANCELADA"
  | "INTEGRACAO_DESCONECTADA";

export interface Notificacao {
  id: string;
  type: TipoNotificacao;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface ListaDeNotificacoes {
  itens: Notificacao[];
  naoLidas: number;
}
