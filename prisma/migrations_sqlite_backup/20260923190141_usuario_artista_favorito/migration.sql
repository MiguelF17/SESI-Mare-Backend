-- CreateTable
CREATE TABLE "UsuarioArtista" (
    "usuarioId" INTEGER NOT NULL,
    "artistaId" INTEGER NOT NULL,

    PRIMARY KEY ("usuarioId", "artistaId"),
    CONSTRAINT "UsuarioArtista_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsuarioArtista_artistaId_fkey" FOREIGN KEY ("artistaId") REFERENCES "Artista" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
