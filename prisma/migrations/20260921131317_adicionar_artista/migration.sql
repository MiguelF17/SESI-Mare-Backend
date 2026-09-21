/*
  Warnings:

  - You are about to drop the column `artista` on the `Musica` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[usuarioId,musicaId]` on the table `Post` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `artistaId` to the `Musica` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Artista" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "fotoURL" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Musica" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spotifyId" TEXT,
    "titulo" TEXT NOT NULL,
    "artistaId" INTEGER NOT NULL,
    "genero" TEXT NOT NULL,
    "duracaoSegundos" INTEGER NOT NULL,
    "capa" TEXT,
    "spotifyUrl" TEXT,
    CONSTRAINT "Musica_artistaId_fkey" FOREIGN KEY ("artistaId") REFERENCES "Artista" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Musica" ("capa", "duracaoSegundos", "genero", "id", "spotifyId", "spotifyUrl", "titulo") SELECT "capa", "duracaoSegundos", "genero", "id", "spotifyId", "spotifyUrl", "titulo" FROM "Musica";
DROP TABLE "Musica";
ALTER TABLE "new_Musica" RENAME TO "Musica";
CREATE UNIQUE INDEX "Musica_spotifyId_key" ON "Musica"("spotifyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Post_usuarioId_musicaId_key" ON "Post"("usuarioId", "musicaId");
