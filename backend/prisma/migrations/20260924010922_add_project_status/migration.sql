-- DropIndex
DROP INDEX "projects_description_trgm_idx";

-- DropIndex
DROP INDEX "projects_name_trgm_idx";

-- DropIndex
DROP INDEX "tasks_description_trgm_idx";

-- DropIndex
DROP INDEX "tasks_title_trgm_idx";

-- DropIndex
DROP INDEX "teams_description_trgm_idx";

-- DropIndex
DROP INDEX "teams_name_trgm_idx";

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "status" "TaskStatus" NOT NULL DEFAULT 'A_FAZER';
