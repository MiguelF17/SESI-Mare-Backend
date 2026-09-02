/*
  Warnings:

  - Added the required column `artista` to the `Musica` table without a default value. This is not possible if the table is not empty.
  - Added the required column `duracaoSegundos` to the `Musica` table without a default value. This is not possible if the table is not empty.
  - Added the required column `genero` to the `Musica` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Musica" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "artista" TEXT NOT NULL,
    "genero" TEXT NOT NULL,
    "duracaoSegundos" INTEGER NOT NULL
);
INSERT INTO "new_Musica" ("id", "titulo") SELECT "id", "titulo" FROM "Musica";
DROP TABLE "Musica";
ALTER TABLE "new_Musica" RENAME TO "Musica";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
