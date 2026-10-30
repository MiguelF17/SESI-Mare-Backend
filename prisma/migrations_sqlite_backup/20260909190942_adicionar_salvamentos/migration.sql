-- CreateTable
CREATE TABLE "Salvamento" (
    "usuarioId" INTEGER NOT NULL,
    "musicaId" INTEGER NOT NULL,
    "dataCriacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("usuarioId", "musicaId"),
    CONSTRAINT "Salvamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Salvamento_musicaId_fkey" FOREIGN KEY ("musicaId") REFERENCES "Musica" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
