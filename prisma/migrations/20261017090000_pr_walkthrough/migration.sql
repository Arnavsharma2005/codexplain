-- CreateTable
CREATE TABLE "PrWalkthrough" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "createdById" TEXT,
    "number" INTEGER NOT NULL,
    "headSha" TEXT NOT NULL,
    "baseSha" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "additions" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "changedFiles" INTEGER NOT NULL DEFAULT 0,
    "status" "IntelStatus" NOT NULL DEFAULT 'INDEXING',
    "error" TEXT,
    "model" TEXT,
    "data" JSONB,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrWalkthrough_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrWalkthrough_repositoryId_number_createdAt_idx" ON "PrWalkthrough"("repositoryId", "number", "createdAt");

-- CreateIndex
CREATE INDEX "PrWalkthrough_status_createdAt_idx" ON "PrWalkthrough"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PrWalkthrough_createdById_createdAt_idx" ON "PrWalkthrough"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrWalkthrough_repositoryId_number_headSha_key" ON "PrWalkthrough"("repositoryId", "number", "headSha");

-- AddForeignKey
ALTER TABLE "PrWalkthrough" ADD CONSTRAINT "PrWalkthrough_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrWalkthrough" ADD CONSTRAINT "PrWalkthrough_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

