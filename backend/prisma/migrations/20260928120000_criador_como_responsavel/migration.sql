-- Tarefas sem responsável passam a ser de quem as criou.
--
-- Desde esta versão, `criarTarefa` atribui o criador quando ninguém é
-- escolhido. Esta migração leva as tarefas antigas ao mesmo estado; sem isso
-- elas não aparecem nas listas pessoais (seções de prioridade, Vencem Hoje).
--
-- Só atribui se o criador ainda for membro do projeto: a regra de negócio
-- exige que o responsável participe dele. Tarefas na Lixeira ficam como estão.

INSERT INTO "task_assignees" ("taskId", "userId")
SELECT t."id", t."createdById"
FROM "tasks" t
WHERE t."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "task_assignees" a WHERE a."taskId" = t."id"
  )
  AND EXISTS (
    SELECT 1 FROM "project_members" pm
    WHERE pm."projectId" = t."projectId" AND pm."userId" = t."createdById"
  );
