-- CreateEnum
CREATE TYPE "GoogleIntegrationStatus" AS ENUM ('ATIVA', 'PRECISA_RECONECTAR');

-- CreateEnum
CREATE TYPE "GoogleSyncStatus" AS ENUM ('PENDENTE', 'SINCRONIZADO', 'REMOVER', 'ERRO');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'INTEGRACAO_DESCONECTADA';

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "meetLink" TEXT;

-- CreateTable
CREATE TABLE "google_integrations" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "status" "GoogleIntegrationStatus" NOT NULL DEFAULT 'ATIVA',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_event_syncs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventId" UUID,
    "googleEventId" TEXT,
    "status" "GoogleSyncStatus" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_event_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_integrations_userId_key" ON "google_integrations"("userId");

-- CreateIndex
CREATE INDEX "google_event_syncs_status_updatedAt_idx" ON "google_event_syncs"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "google_event_syncs_userId_eventId_key" ON "google_event_syncs"("userId", "eventId");

-- AddForeignKey
ALTER TABLE "google_integrations" ADD CONSTRAINT "google_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_event_syncs" ADD CONSTRAINT "google_event_syncs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_event_syncs" ADD CONSTRAINT "google_event_syncs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
