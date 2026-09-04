/*
  Warnings:

  - You are about to drop the column `enabled` on the `City` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[playerId,puzzleDate]` on the table `GameSession` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `playerId` to the `GameSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "City" DROP COLUMN "enabled",
ADD COLUMN     "aliases" TEXT[],
ADD COLUMN     "answerable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "guessable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "playerId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_playerId_puzzleDate_key" ON "GameSession"("playerId", "puzzleDate");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
