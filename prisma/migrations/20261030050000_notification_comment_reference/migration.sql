ALTER TABLE "Notificacao"
ADD COLUMN "comentarioId" INTEGER;

CREATE INDEX "Notificacao_comentarioId_idx"
ON "Notificacao"("comentarioId");
