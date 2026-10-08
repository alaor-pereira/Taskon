import { NotificationType } from "@prisma/client";

/**
 * Chave de preferência de uma notificação: o que o usuário liga ou desliga em
 * Configurações > Notificações.
 *
 * Quase sempre é o próprio tipo. `CONVITE_EQUIPE` e `CONVITE_PROJETO`, porém,
 * agrupam vários eventos (papel alterado, removido, propriedade recebida…),
 * distinguidos por `payload.evento` — para esses, a chave é "GRUPO:EVENTO",
 * e cada evento pode ser desligado separadamente.
 */
export function chaveDaNotificacao(
  type: NotificationType,
  payload: Record<string, unknown>,
): string {
  const evento = typeof payload.evento === "string" ? payload.evento : null;
  if (type === NotificationType.CONVITE_EQUIPE && evento) return `EQUIPE:${evento}`;
  if (type === NotificationType.CONVITE_PROJETO && evento) return `PROJETO:${evento}`;
  return type;
}

/**
 * As chaves que o usuário pode desligar. Fora desta lista, o aviso é sempre
 * entregue — é o caso do convite para equipe ("EQUIPE:CONVITE_RECEBIDO"), que
 * pede uma resposta e não pode sumir sem a pessoa saber.
 */
export const CHAVES_CONFIGURAVEIS = [
  // Tarefas
  "TAREFA_ATRIBUIDA",
  "TAREFA_DESATRIBUIDA",
  "TAREFA_VENCENDO",
  "TAREFA_ATRASADA",
  // Comentários
  "MENCAO_COMENTARIO",
  "COMENTARIO_NA_TAREFA",
  // Reuniões
  "REUNIAO_AGENDADA",
  "REUNIAO_ALTERADA",
  "REUNIAO_CANCELADA",
  // Equipes
  "EQUIPE:PAPEL_ALTERADO",
  "EQUIPE:REMOVIDO_DA_EQUIPE",
  "EQUIPE:PROPRIEDADE_RECEBIDA",
  "EQUIPE:EQUIPE_EXCLUIDA",
  "EQUIPE:CONVITE_ACEITO",
  "EQUIPE:CONVITE_RECUSADO",
  // Projetos
  "PROJETO:ADICIONADO_AO_PROJETO",
  "PROJETO:PAPEL_ALTERADO",
  "PROJETO:REMOVIDO_DO_PROJETO",
  "PROJETO:PROPRIEDADE_RECEBIDA",
] as const;

export type ChaveConfiguravel = (typeof CHAVES_CONFIGURAVEIS)[number];

export function ehChaveConfiguravel(chave: string): chave is ChaveConfiguravel {
  return (CHAVES_CONFIGURAVEIS as readonly string[]).includes(chave);
}
