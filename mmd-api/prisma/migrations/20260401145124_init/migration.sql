-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
    "ownerUserId" TEXT,
    CONSTRAINT "games_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "games_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_games" ("createdAt", "currentAct", "hostKey", "id", "locationText", "name", "scheduledTime", "stageImage", "stageText", "stageTitle", "startedAt", "state", "storyFile", "storyId", "updatedAt") SELECT "createdAt", "currentAct", "hostKey", "id", "locationText", "name", "scheduledTime", "stageImage", "stageText", "stageTitle", "startedAt", "state", "storyFile", "storyId", "updatedAt" FROM "games";
DROP TABLE "games";
ALTER TABLE "new_games" RENAME TO "games";
CREATE UNIQUE INDEX "games_hostKey_key" ON "games"("hostKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
