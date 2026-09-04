/*
  Warnings:

  - The primary key for the `GameSession` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `attempts` on the `GameSession` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `GameSession` table. All the data in the column will be lost.
  - You are about to drop the column `playerId` on the `GameSession` table. All the data in the column will be lost.
  - You are about to drop the column `won` on the `GameSession` table. All the data in the column will be lost.
  - You are about to drop the `Player` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `puzzleDate` to the `GameSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetCityId` to the `GameSession` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_playerId_fkey";

-- DropIndex
DROP INDEX "GameSession_playerId_date_key";

-- AlterTable
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_pkey",
DROP COLUMN "attempts",
DROP COLUMN "date",
DROP COLUMN "playerId",
DROP COLUMN "won",
ADD COLUMN     "puzzleDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "targetCityId" INTEGER NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "GameSession_id_seq";

-- DropTable
DROP TABLE "Player";

-- CreateTable
CREATE TABLE "Guess" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "cityId" INTEGER NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "direction" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guess_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Guess" ADD CONSTRAINT "Guess_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guess" ADD CONSTRAINT "Guess_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
