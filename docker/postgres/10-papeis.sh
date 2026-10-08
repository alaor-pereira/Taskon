#!/bin/sh
# Papéis do PostgreSQL em produção (menor privilégio), equivalente a
# scripts/papeis-do-banco.sql, mas com a senha vinda do ambiente.
#
#   POSTGRES_USER  dono do schema; só as migrações o usam (DIRECT_URL)
#   taskon_app     o servidor (DATABASE_URL): lê e escreve dados, mas não
#                  cria, altera nem apaga tabelas
#
# Roda uma única vez, quando o volume do banco é criado.
set -eu

: "${APP_DB_PASSWORD:?defina POSTGRES_APP_PASSWORD no ambiente}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v dono="$POSTGRES_USER" -v banco="$POSTGRES_DB" -v senha="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE taskon_app LOGIN PASSWORD :'senha'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE :"banco" TO taskon_app;
GRANT USAGE ON SCHEMA public TO taskon_app;
-- As tabelas nascem nas migrações, já com estas permissões.
ALTER DEFAULT PRIVILEGES FOR ROLE :"dono" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO taskon_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :"dono" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO taskon_app;
SQL
