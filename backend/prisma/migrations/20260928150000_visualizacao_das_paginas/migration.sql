-- CreateEnum
CREATE TYPE "ViewPage" AS ENUM ('TODOS_PROJETOS', 'TODAS_TAREFAS');

-- CreateTable
CREATE TABLE "user_page_view_preferences" (
    "userId" UUID NOT NULL,
    "page" "ViewPage" NOT NULL,
    "view" "ViewMode" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_page_view_preferences_pkey" PRIMARY KEY ("userId","page")
);

-- AddForeignKey
ALTER TABLE "user_page_view_preferences" ADD CONSTRAINT "user_page_view_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

