-- Tokens dos aparelhos que autorizaram notificações push.
CREATE TABLE "TokenNotificacaoPush" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL DEFAULT 'android',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenNotificacaoPush_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TokenNotificacaoPush_token_key"
    ON "TokenNotificacaoPush"("token");
CREATE INDEX "TokenNotificacaoPush_usuarioId_idx"
    ON "TokenNotificacaoPush"("usuarioId");

ALTER TABLE "TokenNotificacaoPush"
    ADD CONSTRAINT "TokenNotificacaoPush_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
