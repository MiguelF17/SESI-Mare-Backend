ALTER TABLE "Usuario" ADD COLUMN "emailPendente" TEXT;
CREATE UNIQUE INDEX "Usuario_emailPendente_key" ON "Usuario"("emailPendente");
