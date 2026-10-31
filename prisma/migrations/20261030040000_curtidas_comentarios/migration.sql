CREATE TABLE "ComentarioCurtida" (
  "usuarioId" INTEGER NOT NULL,
  "comentarioId" INTEGER NOT NULL,
  "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ComentarioCurtida_pkey" PRIMARY KEY ("usuarioId", "comentarioId")
);

CREATE INDEX "ComentarioCurtida_comentarioId_idx"
  ON "ComentarioCurtida"("comentarioId");

ALTER TABLE "ComentarioCurtida"
  ADD CONSTRAINT "ComentarioCurtida_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComentarioCurtida"
  ADD CONSTRAINT "ComentarioCurtida_comentarioId_fkey"
  FOREIGN KEY ("comentarioId") REFERENCES "Comentario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
