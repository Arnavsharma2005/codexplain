-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "IntelStatus" AS ENUM ('INDEXING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "IntelIndex" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "createdById" TEXT,
    "ref" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "status" "IntelStatus" NOT NULL DEFAULT 'INDEXING',
    "error" TEXT,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "symbolCount" INTEGER NOT NULL DEFAULT 0,
    "edgeCount" INTEGER NOT NULL DEFAULT 0,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "embeddedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelFile" (
    "id" TEXT NOT NULL,
    "indexId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "language" TEXT,
    "bytes" INTEGER NOT NULL,
    "lines" INTEGER NOT NULL,

    CONSTRAINT "IntelFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelSymbol" (
    "id" TEXT NOT NULL,
    "indexId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startLine" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,
    "exported" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IntelSymbol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelEdge" (
    "indexId" TEXT NOT NULL,
    "fromFileId" TEXT NOT NULL,
    "toFileId" TEXT NOT NULL,

    CONSTRAINT "IntelEdge_pkey" PRIMARY KEY ("fromFileId","toFileId")
);

-- CreateTable
CREATE TABLE "IntelChunk" (
    "id" TEXT NOT NULL,
    "indexId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "startLine" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,
    "symbols" TEXT[],
    "text" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "tsv" tsvector,

    CONSTRAINT "IntelChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelEmbedding" (
    "hash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "vector" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelEmbedding_pkey" PRIMARY KEY ("hash","model")
);

-- CreateIndex
CREATE INDEX "IntelIndex_createdById_createdAt_idx" ON "IntelIndex"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntelIndex_repositoryId_commitSha_key" ON "IntelIndex"("repositoryId", "commitSha");

-- CreateIndex
CREATE UNIQUE INDEX "IntelFile_indexId_path_key" ON "IntelFile"("indexId", "path");

-- CreateIndex
CREATE INDEX "IntelSymbol_indexId_name_idx" ON "IntelSymbol"("indexId", "name");

-- CreateIndex
CREATE INDEX "IntelEdge_indexId_idx" ON "IntelEdge"("indexId");

-- CreateIndex
CREATE INDEX "IntelChunk_indexId_idx" ON "IntelChunk"("indexId");

-- CreateIndex
CREATE INDEX "IntelChunk_fileId_startLine_idx" ON "IntelChunk"("fileId", "startLine");

-- CreateIndex
CREATE INDEX "IntelChunk_hash_idx" ON "IntelChunk"("hash");

-- CreateIndex
CREATE INDEX "IntelChunk_tsv_idx" ON "IntelChunk" USING GIN ("tsv");

-- AddForeignKey
ALTER TABLE "IntelIndex" ADD CONSTRAINT "IntelIndex_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelIndex" ADD CONSTRAINT "IntelIndex_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelFile" ADD CONSTRAINT "IntelFile_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "IntelIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelSymbol" ADD CONSTRAINT "IntelSymbol_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "IntelIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelSymbol" ADD CONSTRAINT "IntelSymbol_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "IntelFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelEdge" ADD CONSTRAINT "IntelEdge_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "IntelIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelEdge" ADD CONSTRAINT "IntelEdge_fromFileId_fkey" FOREIGN KEY ("fromFileId") REFERENCES "IntelFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelEdge" ADD CONSTRAINT "IntelEdge_toFileId_fkey" FOREIGN KEY ("toFileId") REFERENCES "IntelFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelChunk" ADD CONSTRAINT "IntelChunk_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "IntelIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelChunk" ADD CONSTRAINT "IntelChunk_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "IntelFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

