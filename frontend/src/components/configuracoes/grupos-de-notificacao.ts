/**
 * Avisos configuráveis, agrupados como aparecem em Configurações >
 * Notificações. As chaves são as mesmas do backend
 * (`modules/notifications/notification-keys.ts`); `chave: null` marca um aviso
 * que não pode ser desligado.
 */
export interface ItemDeNotificacao {
  chave: string | null;
  rotulo: string;
  descricao: string;
}

export const GRUPOS_DE_NOTIFICACAO: Array<{ titulo: string; itens: ItemDeNotificacao[] }> = [
  {
    titulo: "Tarefas",
    itens: [
      {
        chave: "TAREFA_ATRIBUIDA",
        rotulo: "Tarefa atribuída a mim",
        descricao: "Quando alguém me coloca como responsável.",
      },
      {
        chave: "TAREFA_DESATRIBUIDA",
        rotulo: "Removido de uma tarefa",
        descricao: "Quando deixo de ser responsável por uma tarefa.",
      },
      {
        chave: "TAREFA_VENCENDO",
        rotulo: "Tarefa vence hoje",
        descricao: "Lembrete no dia do vencimento das minhas tarefas.",
      },
      {
        chave: "TAREFA_ATRASADA",
        rotulo: "Tarefa atrasada",
        descricao: "Aviso no dia seguinte ao vencimento, se ainda não concluída.",
      },
    ],
  },
  {
    titulo: "Comentários",
    itens: [
      {
        chave: "MENCAO_COMENTARIO",
        rotulo: "Menção em comentário",
        descricao: "Quando alguém me menciona com @.",
      },
      {
        chave: "COMENTARIO_NA_TAREFA",
        rotulo: "Comentário em tarefa minha",
        descricao: "Novos comentários em tarefas que criei ou pelas quais respondo.",
      },
    ],
  },
  {
    titulo: "Reuniões",
    itens: [
      {
        chave: "REUNIAO_AGENDADA",
        rotulo: "Reunião agendada",
        descricao: "Quando sou convidado para uma reunião.",
      },
      {
        chave: "REUNIAO_ALTERADA",
        rotulo: "Reunião alterada",
        descricao: "Quando o horário de uma reunião muda.",
      },
      {
        chave: "REUNIAO_CANCELADA",
        rotulo: "Reunião cancelada",
        descricao: "Quando uma reunião da qual participo é cancelada.",
      },
    ],
  },
  {
    titulo: "Equipes",
    itens: [
      {
        chave: null,
        rotulo: "Convite para equipe",
        descricao: "Quando alguém me convida para uma equipe.",
      },
      {
        chave: "EQUIPE:CONVITE_ACEITO",
        rotulo: "Convite aceito",
        descricao: "Quando alguém aceita um convite que enviei.",
      },
      {
        chave: "EQUIPE:CONVITE_RECUSADO",
        rotulo: "Convite recusado",
        descricao: "Quando alguém recusa um convite que enviei.",
      },
      {
        chave: "EQUIPE:PAPEL_ALTERADO",
        rotulo: "Papel na equipe alterado",
        descricao: "Quando meu papel numa equipe muda.",
      },
      {
        chave: "EQUIPE:REMOVIDO_DA_EQUIPE",
        rotulo: "Removido da equipe",
        descricao: "Quando sou removido de uma equipe.",
      },
      {
        chave: "EQUIPE:PROPRIEDADE_RECEBIDA",
        rotulo: "Propriedade da equipe recebida",
        descricao: "Quando me tornam dono de uma equipe.",
      },
      {
        chave: "EQUIPE:EQUIPE_EXCLUIDA",
        rotulo: "Equipe excluída",
        descricao: "Quando uma equipe da qual participo é excluída.",
      },
    ],
  },
  {
    titulo: "Projetos",
    itens: [
      {
        chave: "PROJETO:ADICIONADO_AO_PROJETO",
        rotulo: "Adicionado a um projeto",
        descricao: "Quando alguém me inclui num projeto.",
      },
      {
        chave: "PROJETO:PAPEL_ALTERADO",
        rotulo: "Papel no projeto alterado",
        descricao: "Quando meu papel num projeto muda.",
      },
      {
        chave: "PROJETO:REMOVIDO_DO_PROJETO",
        rotulo: "Removido do projeto",
        descricao: "Quando sou removido de um projeto.",
      },
      {
        chave: "PROJETO:PROPRIEDADE_RECEBIDA",
        rotulo: "Propriedade do projeto recebida",
        descricao: "Quando me tornam dono de um projeto.",
      },
    ],
  },
];
