-- Allow deleting a user and automatically removing their dependent records.
ALTER TABLE "Post"
  DROP CONSTRAINT "Post_usuarioId_fkey",
  ADD CONSTRAINT "Post_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Curtida"
  DROP CONSTRAINT "Curtida_usuarioId_fkey",
  ADD CONSTRAINT "Curtida_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comentario"
  DROP CONSTRAINT "Comentario_usuarioId_fkey",
  ADD CONSTRAINT "Comentario_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Seguidor"
  DROP CONSTRAINT "Seguidor_seguidorId_fkey",
  ADD CONSTRAINT "Seguidor_seguidorId_fkey"
    FOREIGN KEY ("seguidorId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Seguidor"
  DROP CONSTRAINT "Seguidor_seguidoId_fkey",
  ADD CONSTRAINT "Seguidor_seguidoId_fkey"
    FOREIGN KEY ("seguidoId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Salvamento"
  DROP CONSTRAINT "Salvamento_usuarioId_fkey",
  ADD CONSTRAINT "Salvamento_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
