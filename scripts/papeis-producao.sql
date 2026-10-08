-- Papel do servidor no PostgreSQL de produção (menor privilégio), equivalente
-- a scripts/papeis-do-banco.sql, mas para o banco gerenciado do Coolify.
--
--   usuário da DIRECT_URL  dono do schema; só as migrações o usam
--   taskon_app             o servidor (DATABASE_URL): lê e escreve dados, mas
--                          não cria, altera nem apaga tabelas
--
-- Rode antes do primeiro deploy, conectado como o usuário da DIRECT_URL (os
-- privilégios padrão valem para as tabelas que ELE criar nas migrações):
--
--   psql "postgresql://postgres:SENHA@HOST:5432/BANCO" -v senha=SENHA_DO_APP -f scripts/papeis-producao.sql
--
-- No Terminal do banco no Coolify: abra o psql, rode \set senha 'SENHA_DO_APP'
-- e cole o restante. Pode ser repetido; repetir com outra senha a troca.

\set ON_ERROR_STOP on

\if :{?senha}
\else
  \echo 'Defina a senha do taskon_app: -v senha=... (ou \\set senha ''...'')'
  \quit
\endif

SELECT 'CREATE ROLE taskon_app'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'taskon_app')
\gexec

ALTER ROLE taskon_app WITH LOGIN PASSWORD :'senha'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SELECT format('GRANT CONNECT ON DATABASE %I TO taskon_app', current_database())
\gexec
GRANT USAGE ON SCHEMA public TO taskon_app;
-- Caso as migrações já tenham rodado.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO taskon_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taskon_app;
-- Tabelas criadas por migrações futuras já nascem com as mesmas permissões.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO taskon_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO taskon_app;
