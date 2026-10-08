-- Dificuldade estimada (projetos e tarefas) e prioridade/prazo do projeto.
--
-- Escrita à mão: o `prisma migrate dev` compara com o schema e removeria os
-- índices trigram de busca, que não são declarados no schema.prisma.

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('ROTINEIRO', 'COMPLEXO', 'CRITICO');

-- AlterTable: projetos existentes ficam com prioridade Média e sem
-- dificuldade nem prazo — nada é estimado por eles.
ALTER TABLE "projects"
  ADD COLUMN "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIA',
  ADD COLUMN "difficulty" "Difficulty",
  ADD COLUMN "dueDate" DATE;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "difficulty" "Difficulty";
