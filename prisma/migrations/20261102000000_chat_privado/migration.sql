-- Estrutura inicial para conversas privadas individuais.
CREATE TABLE "ConversaPrivada" (
    "id" SERIAL NOT NULL,
    "usuarioUmId" INTEGER NOT NULL,
    "usuarioDoisId" INTEGER NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversaPrivada_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MensagemPrivada" (
    "id" SERIAL NOT NULL,
    "conversaId" INTEGER NOT NULL,
    "remetenteId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidaEm" TIMESTAMP(3),

    CONSTRAINT "MensagemPrivada_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversaPrivada_usuarioUmId_usuarioDoisId_key"
    ON "ConversaPrivada"("usuarioUmId", "usuarioDoisId");
CREATE INDEX "ConversaPrivada_usuarioUmId_atualizadaEm_idx"
    ON "ConversaPrivada"("usuarioUmId", "atualizadaEm");
CREATE INDEX "ConversaPrivada_usuarioDoisId_atualizadaEm_idx"
    ON "ConversaPrivada"("usuarioDoisId", "atualizadaEm");
CREATE INDEX "MensagemPrivada_conversaId_id_idx"
    ON "MensagemPrivada"("conversaId", "id");
CREATE INDEX "MensagemPrivada_remetenteId_lidaEm_idx"
    ON "MensagemPrivada"("remetenteId", "lidaEm");

ALTER TABLE "ConversaPrivada"
    ADD CONSTRAINT "ConversaPrivada_usuarioUmId_fkey"
    FOREIGN KEY ("usuarioUmId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversaPrivada"
    ADD CONSTRAINT "ConversaPrivada_usuarioDoisId_fkey"
    FOREIGN KEY ("usuarioDoisId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MensagemPrivada"
    ADD CONSTRAINT "MensagemPrivada_conversaId_fkey"
    FOREIGN KEY ("conversaId") REFERENCES "ConversaPrivada"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MensagemPrivada"
    ADD CONSTRAINT "MensagemPrivada_remetenteId_fkey"
    FOREIGN KEY ("remetenteId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
