-- CreateTable
CREATE TABLE "UsuarioGenero" (
    "usuarioId" INTEGER NOT NULL,
    "genero" TEXT NOT NULL,

    PRIMARY KEY ("usuarioId", "genero"),
    CONSTRAINT "UsuarioGenero_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
