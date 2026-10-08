/**
 * Preparação do ambiente de testes.
 *
 * O código aqui roda no escopo do módulo, de propósito: os arquivos de teste
 * importam os serviços, que importam `config/env.ts`, e essa validação acontece
 * na importação. Um `beforeAll` seria tarde demais — o import já teria falhado.
 *
 * Os testes exigem um PostgreSQL real, porque as regras de visibilidade são
 * aplicadas em consultas: um banco falso não provaria nada.
 */

const url = process.env.TEST_DATABASE_URL;

if (!url) {
  throw new Error(
    "TEST_DATABASE_URL não definida. Aponte para um banco de teste dedicado — " +
      "os testes apagam todas as tabelas entre execuções.\n" +
      "Com o docker-compose deste repositório:\n" +
      '  postgresql://taskon:taskon@localhost:5434/taskon_test?schema=public',
  );
}

process.env.DATABASE_URL = url;
process.env.NODE_ENV = "test";
process.env.BETTER_AUTH_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres";
process.env.BETTER_AUTH_URL ??= "http://localhost:3333";
process.env.FRONTEND_URL ??= "http://localhost:3000";
// Credenciais fictícias: as chamadas ao Google são simuladas nos testes.
process.env.GOOGLE_CLIENT_ID ??= "cliente-de-teste.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET ??= "segredo-de-teste";
