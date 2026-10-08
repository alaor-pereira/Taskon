# Backend do Taskon (Fastify + Prisma).
#
# Ao subir, o container aplica as migrações pendentes (prisma migrate deploy,
# pela DIRECT_URL) e só então inicia a API. Migração com erro impede a subida,
# em vez de deixar a API rodando contra um schema desatualizado.

FROM node:22-alpine AS base
# O motor do Prisma precisa da OpenSSL.
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate --schema prisma/schema.prisma && npm run build

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma ./prisma
RUN ./node_modules/.bin/prisma generate --schema prisma/schema.prisma
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:3000/health || exit 1
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma && exec node dist/index.js"]
