-- Papéis do PostgreSQL (menor privilégio).
--
--   taskon      superusuário criado pela imagem; só administração e migrações
--               (DIRECT_URL). Em produção, troque por um papel sem SUPERUSER
--               que seja apenas dono do schema.
--   taskon_app  o que o servidor e os testes usam (DATABASE_URL): lê e escreve
--               dados, mas não cria, altera nem apaga tabelas. Uma injeção de
--               SQL ou um bug não conseguem destruir o schema nem ler outros
--               bancos.
--
-- Roda sozinho na criação do volume (docker-entrypoint-initdb.d) e pode ser
-- reaplicado num banco existente:
--   docker exec -i taskon-postgres psql -U taskon -d postgres < scripts/papeis-do-banco.sql
--
-- A senha abaixo é só de desenvolvimento.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'taskon_app') THEN
    CREATE ROLE taskon_app LOGIN PASSWORD 'taskon_app'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

\connect taskon_dev
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE taskon_dev TO taskon_app;
GRANT USAGE ON SCHEMA public TO taskon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO taskon_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taskon_app;
-- Tabelas criadas por migrações futuras já nascem com as mesmas permissões.
ALTER DEFAULT PRIVILEGES FOR ROLE taskon IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO taskon_app;
ALTER DEFAULT PRIVILEGES FOR ROLE taskon IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO taskon_app;

\connect taskon_test
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE taskon_test TO taskon_app;
GRANT USAGE ON SCHEMA public TO taskon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO taskon_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taskon_app;
ALTER DEFAULT PRIVILEGES FOR ROLE taskon IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO taskon_app;
ALTER DEFAULT PRIVILEGES FOR ROLE taskon IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO taskon_app;
