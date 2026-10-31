ALTER TABLE "Comentario"
  ADD COLUMN "respostaAId" INTEGER;

ALTER TABLE "Post"
  ADD COLUMN "editado" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Comentario_respostaAId_idx"
  ON "Comentario"("respostaAId");

ALTER TABLE "Comentario"
  ADD CONSTRAINT "Comentario_respostaAId_fkey"
  FOREIGN KEY ("respostaAId") REFERENCES "Comentario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
