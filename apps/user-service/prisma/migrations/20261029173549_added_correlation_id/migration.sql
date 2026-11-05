/*
  Warnings:

  - Added the required column `correlationId` to the `outbox` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "OutboxStatus" ADD VALUE 'PUBLISHING';

-- AlterTable
ALTER TABLE "outbox" ADD COLUMN     "correlationId" TEXT NOT NULL;
