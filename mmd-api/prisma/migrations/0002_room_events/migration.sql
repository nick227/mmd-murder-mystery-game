-- Add stage fields to games table
ALTER TABLE "games" ADD COLUMN "stageTitle" TEXT;
ALTER TABLE "games" ADD COLUMN "stageText" TEXT;
ALTER TABLE "games" ADD COLUMN "stageImage" TEXT;

-- Create game_events table (append-only event log for room feed)
CREATE TABLE "game_events" (
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "gameId"    TEXT     NOT NULL,
    "playerId"  TEXT,
    "type"      TEXT     NOT NULL,
    "payload"   BLOB     NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_events_gameId_fkey"   FOREIGN KEY ("gameId")   REFERENCES "games"        ("id") ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "game_events_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "game_players"  ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indexes: primary access pattern is game feed ordered by time
CREATE INDEX "game_events_gameId_createdAt_idx" ON "game_events"("gameId", "createdAt");
CREATE INDEX "game_events_playerId_idx"          ON "game_events"("playerId");
