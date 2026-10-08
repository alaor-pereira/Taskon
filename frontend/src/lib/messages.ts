/**
 * Textos da interface, em um lugar só.
 *
 * O sistema é apenas em português do Brasil, mas centralizar aqui deixa a
 * tradução futura barata e evita a mesma frase escrita de três jeitos.
 */
export const t = {
  app: {
    nome: "Taskon",
  },

  nav: {
    home: "Home",
    equipes: "Equipes",
    projetos: "Projetos",
    tarefas: "Tarefas",
    agenda: "Agenda",
    lixeira: "Lixeira",
    recolher: "Recolher a barra lateral",
    expandir: "Expandir a barra lateral",
    abrirMenu: "Abrir a barra lateral",
    fecharMenu: "Fechar a barra lateral",
    buscar: "Buscar",
    buscarPlaceholder: "Buscar no Taskon",
    notificacoes: "Notificações",
    sair: "Sair",
    tema: "Alternar tema",
  },

  tema: {
    claro: "Claro",
    escuro: "Escuro",
    sistema: "Sistema",
  },

  secoes: {
    visaoGeral: "Visão Geral",
    dashboard: "Dashboard",
    caixaDeEntrada: "Caixa de Entrada",
    recentes: "Recentes",
    vencemHoje: "Vencem Hoje",
    vencidas: "Vencidas",
    equipesQueAdministro: "Equipes que Administro",
    equipesQueParticipo: "Equipes que Participo",
    meusProjetos: "Meus Projetos",
    projetosQueParticipo: "Projetos em Equipe",
    prioridadeAlta: "Prioridade Alta",
    prioridadeMedia: "Prioridade Média",
    prioridadeBaixa: "Prioridade Baixa",
    atividadeParaHoje: "Atividade para Hoje",
    proximasAtividades: "Próximas Atividades",
    reunioesAgendadas: "Reuniões Agendadas",
    projetosExcluidos: "Projetos Excluídos",
    tarefasExcluidas: "Tarefas Excluídas",
  },

  /** Título das páginas abertas pelos ícones da barra lateral (e da aba). */
  paginas: {
    dashboard: "Dashboard",
    equipes: "Equipes",
    todosProjetos: "Todos os projetos",
    todasTarefas: "Todas as tarefas",
    agenda: "Agenda",
    lixeira: "Lixeira",
    perfil: "Meu perfil",
    configuracoes: "Configurações",
  },

  legal: {
    saibaMais: "Saiba mais",
  },

  acoes: {
    adicionar: "Adicionar",
    novaEquipe: "Nova equipe",
    restaurar: "Restaurar",
    esvaziarLixeira: "Esvaziar lixeira",
    limparSelecao: "Limpar seleção",
    excluirDefinitivamente: "Excluir definitivamente",
    fechar: "Fechar",
    fecharAba: "Fechar aba",
    cancelar: "Cancelar",
    salvar: "Salvar",
  },

  vazio: {
    semTarefasRecentes: "Nenhuma tarefa modificada recentemente.",
    semTarefasHoje: "Nenhuma tarefa vence hoje.",
    semTarefasVencidas: "Nenhuma tarefa vencida.",
    semEquipes: "Você ainda não faz parte de nenhuma equipe.",
    semEquipesQueAdministro: "Você ainda não administra nenhuma equipe.",
    semProjetos: "Nenhum projeto por aqui.",
    /** Seções de prioridade da barra lateral. */
    semTarefas: "Nenhuma tarefa nesta prioridade.",
    /** Listas, cartões e quadros de tarefas. */
    semTarefasNaLista: "Nenhuma tarefa por aqui.",
    semSubtarefas: "Nenhuma subtarefa ainda.",
    semAtividades: "Nenhuma atividade marcada.",
    semReunioes: "Nenhuma reunião agendada.",
    lixeiraVazia: "A lixeira está vazia.",
    semProjetosExcluidos: "Nenhum projeto na lixeira.",
    semTarefasExcluidas: "Nenhuma tarefa na lixeira.",
    semEquipesNoFiltro: "Nenhuma equipe neste filtro.",
    semAbas: "Escolha um item na barra lateral para abrir uma aba.",
  },

  visualizacao: {
    cards: "Cards",
    kanban: "Kanban",
    lista: "Lista",
    rotulo: "Visualização",
  },

  status: {
    BACKLOG: "Backlog",
    A_FAZER: "A fazer",
    EM_ANDAMENTO: "Em andamento",
    EM_REVISAO: "Em revisão",
    EM_PAUSA: "Em pausa",
    CONCLUIDO: "Concluído",
  },

  prioridade: {
    ALTA: "Alta",
    MEDIA: "Média",
    BAIXA: "Baixa",
  },

  dificuldade: {
    ROTINEIRO: "Rotineiro",
    COMPLEXO: "Complexo",
    CRITICO: "Crítico",
    naoEstimada: "Não estimada",
  },

  respostaDeParticipante: {
    PENDENTE: "Pendente",
    ACEITO: "Aceitou",
    RECUSADO: "Recusou",
  },

  papelEquipe: {
    GESTOR: "Gestor",
    MEMBRO: "Membro",
    VISUALIZADOR: "Visualizador",
  },

  papelProjeto: {
    OWNER: "Proprietário",
    EDITOR: "Editor",
    VIEWER: "Visualizador",
  },

  auth: {
    entrar: "Entrar",
    criarConta: "Criar conta",
    email: "E-mail",
    senha: "Senha",
    nome: "Nome",
    esqueciSenha: "Esqueci minha senha",
    entrarComGoogle: "Entrar com Google",
    entrarComGitHub: "Entrar com GitHub",
    jaTenhoConta: "Já tenho uma conta",
    aindaNaoTenhoConta: "Ainda não tenho conta",
    verifiqueSeuEmail: "Verifique seu e-mail",
    verificacaoEnviada:
      "Enviamos um link de confirmação. Confirme seu e-mail para entrar.",
    ouContinueCom: "ou continue com",
  },

  erros: {
    generico: "Algo deu errado. Tente novamente.",
    semConexao: "Não foi possível falar com o servidor.",
    naoAutenticado: "Sua sessão expirou. Entre novamente.",
    conflito: "Este item foi alterado por outra pessoa. Recarregue para ver a versão atual.",
  },
} as const;

/** Rótulo do dia, no formato usado nas listas da barra lateral. */
export const ultimaAlteracaoPor = (nome: string, quando: string) =>
  `Alterado por ${nome} ${quando}`;
