-- Executado uma única vez, na criação do volume do PostgreSQL.
-- O banco de testes é separado porque a bateria apaga todas as tabelas
-- entre execuções: apontá-la para o banco de desenvolvimento destruiria
-- os dados de trabalho.
CREATE DATABASE taskon_test OWNER taskon;
