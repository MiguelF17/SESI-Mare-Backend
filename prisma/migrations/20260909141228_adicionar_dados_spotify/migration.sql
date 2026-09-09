/*
  Warnings:

  - Added the required column `spotifyId` to the `Musica` table without a default value. This is not possible if the table is not empty.
  - Added the required column `spotifyUrl` to the `Musica` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Musica" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spotifyId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "artista" TEXT NOT NULL,
    "genero" TEXT NOT NULL,
    "duracaoSegundos" INTEGER NOT NULL,
    "capa" TEXT,
    "spotifyUrl" TEXT NOT NULL
);
INSERT INTO "new_Musica" ("artista", "duracaoSegundos", "genero", "id", "titulo") SELECT "artista", "duracaoSegundos", "genero", "id", "titulo" FROM "Musica";
DROP TABLE "Musica";
ALTER TABLE "new_Musica" RENAME TO "Musica";
CREATE UNIQUE INDEX "Musica_spotifyId_key" ON "Musica"("spotifyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
