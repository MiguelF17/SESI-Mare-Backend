ALTER TABLE "Usuario"
ADD COLUMN "notificacoesCurtidas" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notificacoesComentarios" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notificacoesSeguidores" BOOLEAN NOT NULL DEFAULT true;
