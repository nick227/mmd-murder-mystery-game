/*
  Warnings:

  - You are about to alter the column `payload` on the `game_events` table. The data in that column could be lost. The data in that column will be cast from `Binary` to `Json`.
  - You are about to alter the column `dataJson` on the `stories` table. The data in that column could be lost. The data in that column will be cast from `Binary` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_game_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_events_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "game_events_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "game_players" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_game_events" ("createdAt", "gameId", "id", "payload", "playerId", "type") SELECT "createdAt", "gameId", "id", "payload", "playerId", "type" FROM "game_events";
DROP TABLE "game_events";
ALTER TABLE "new_game_events" RENAME TO "game_events";
CREATE INDEX "game_events_gameId_createdAt_idx" ON "game_events"("gameId", "createdAt");
CREATE INDEX "game_events_playerId_idx" ON "game_events"("playerId");
CREATE TABLE "new_stories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_stories" ("createdAt", "dataJson", "id", "summary", "title", "updatedAt") SELECT "createdAt", "dataJson", "id", "summary", "title", "updatedAt" FROM "stories";
DROP TABLE "stories";
ALTER TABLE "new_stories" RENAME TO "stories";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
