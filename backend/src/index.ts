import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { criarServidor } from "./http/server.js";

async function principal() {
  const app = await criarServidor();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`Taskon API em ${env.BETTER_AUTH_URL} (${env.NODE_ENV})`);

  const encerrar = async (sinal: string) => {
    app.log.info(`Recebido ${sinal}, encerrando.`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void encerrar("SIGINT"));
  process.on("SIGTERM", () => void encerrar("SIGTERM"));
}

principal().catch((erro) => {
  console.error("Falha ao iniciar o servidor:", erro);
  process.exit(1);
});
