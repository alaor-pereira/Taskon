-- Índices para a busca da barra lateral.
--
-- A busca usa ILIKE com curinga dos dois lados ("%relat%"), porque quem digita
-- ali costuma escrever pedaços de palavra. Um índice B-tree comum não serve
-- para esse padrão; os índices GIN de trigrama, sim.
--
-- pg_trgm faz parte da distribuição padrão do PostgreSQL.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Projetos
CREATE INDEX IF NOT EXISTS "projects_name_trgm_idx"
  ON "projects" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "projects_description_trgm_idx"
  ON "projects" USING GIN ("description" gin_trgm_ops);

-- Tarefas
CREATE INDEX IF NOT EXISTS "tasks_title_trgm_idx"
  ON "tasks" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "tasks_description_trgm_idx"
  ON "tasks" USING GIN ("description" gin_trgm_ops);

-- Equipes
CREATE INDEX IF NOT EXISTS "teams_name_trgm_idx"
  ON "teams" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "teams_description_trgm_idx"
  ON "teams" USING GIN ("description" gin_trgm_ops);
