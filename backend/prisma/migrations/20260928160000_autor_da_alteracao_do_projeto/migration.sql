-- Quem alterou o projeto por último, para o "Alterado por…" da página do
-- projeto — o mesmo que a tarefa já tinha.

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "updatedById" UUID;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Projetos existentes: o autor vem do histórico, a última ação que mexeu no
-- próprio projeto. Mudanças de membros não contam — não alteram o projeto.
-- O UPDATE direto não toca em "updatedAt", que continua sendo a data real.
UPDATE "projects" p
SET "updatedById" = ultima."actorId"
FROM (
  SELECT DISTINCT ON (a."entityId") a."entityId", a."actorId"
  FROM "activity_log" a
  WHERE a."entityType" = 'PROJETO'
    AND a."action" IN ('CRIADO', 'ATUALIZADO', 'RESTAURADO', 'PROPRIEDADE_TRANSFERIDA')
  ORDER BY a."entityId", a."createdAt" DESC
) ultima
WHERE ultima."entityId" = p."id";
