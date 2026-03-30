-- CreateTable
CREATE TABLE "stories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "dataJson" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostKey" TEXT NOT NULL,
    "scheduledTime" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "state" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "currentAct" INTEGER NOT NULL DEFAULT 0,
    "locationText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "games_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "game_players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "playerName" TEXT,
    "loginKey" TEXT NOT NULL,
    "joinedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_players_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "game_mystery_answers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_mystery_answers_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "games_hostKey_key" ON "games"("hostKey");

-- CreateIndex
CREATE UNIQUE INDEX "game_players_loginKey_key" ON "game_players"("loginKey");

-- CreateIndex
CREATE UNIQUE INDEX "game_mystery_answers_gameId_track_key" ON "game_mystery_answers"("gameId", "track");
