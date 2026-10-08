-- Novas situações de aviso: deixar de ser responsável, tarefa atrasada,
-- comentários numa tarefa (agrupados enquanto não lidos) e reunião alterada ou
-- cancelada. As situações de pessoas (removido, papel alterado, convite
-- recusado) seguem como `evento` dentro de CONVITE_EQUIPE/CONVITE_PROJETO.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TAREFA_DESATRIBUIDA';
ALTER TYPE "NotificationType" ADD VALUE 'TAREFA_ATRASADA';
ALTER TYPE "NotificationType" ADD VALUE 'COMENTARIO_NA_TAREFA';
ALTER TYPE "NotificationType" ADD VALUE 'REUNIAO_ALTERADA';
ALTER TYPE "NotificationType" ADD VALUE 'REUNIAO_CANCELADA';
