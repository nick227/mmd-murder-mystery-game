-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyFile" TEXT,
    "storyId" TEXT,
    "name" TEXT NOT NULL,
    "hostKey" TEXT NOT NULL,
    "scheduledTime" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "state" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "currentAct" INTEGER NOT NULL DEFAULT 0,
    "locationText" TEXT,
    "stageTitle" TEXT,
    "stageText" TEXT,
    "stageImage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "games_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_games" ("createdAt", "currentAct", "hostKey", "id", "locationText", "name", "scheduledTime", "stageImage", "stageText", "stageTitle", "startedAt", "state", "storyId", "updatedAt") SELECT "createdAt", "currentAct", "hostKey", "id", "locationText", "name", "scheduledTime", "stageImage", "stageText", "stageTitle", "startedAt", "state", "storyId", "updatedAt" FROM "games";
DROP TABLE "games";
ALTER TABLE "new_games" RENAME TO "games";
CREATE UNIQUE INDEX "games_hostKey_key" ON "games"("hostKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
