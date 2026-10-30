-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Musica" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spotifyId" TEXT,
    "titulo" TEXT NOT NULL,
    "artista" TEXT NOT NULL,
    "genero" TEXT NOT NULL,
    "duracaoSegundos" INTEGER NOT NULL,
    "capa" TEXT,
    "spotifyUrl" TEXT
);
INSERT INTO "new_Musica" ("artista", "capa", "duracaoSegundos", "genero", "id", "spotifyId", "spotifyUrl", "titulo") SELECT "artista", "capa", "duracaoSegundos", "genero", "id", "spotifyId", "spotifyUrl", "titulo" FROM "Musica";
DROP TABLE "Musica";
ALTER TABLE "new_Musica" RENAME TO "Musica";
CREATE UNIQUE INDEX "Musica_spotifyId_key" ON "Musica"("spotifyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
