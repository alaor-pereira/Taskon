import { PrismaClient } from "@prisma/client";
import { env, isProduction } from "../config/env.js";

/**
 * Cliente único. Em desenvolvimento, o watch recarrega o módulo e criaria uma
 * conexão nova a cada alteração, então guardamos a instância no escopo global.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ["warn", "error"] : ["warn", "error"],
    datasources: { db: { url: env.DATABASE_URL } },
  });

if (!isProduction) globalForPrisma.prisma = prisma;

/** Tipo da transação, para os serviços aceitarem tanto o cliente quanto a transação. */
export type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
