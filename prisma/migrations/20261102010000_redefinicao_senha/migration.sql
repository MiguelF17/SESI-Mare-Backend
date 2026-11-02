ALTER TABLE "Usuario"
ADD COLUMN "tokenRedefinicaoSenhaHash" TEXT,
ADD COLUMN "tokenRedefinicaoSenhaExpiraEm" TIMESTAMP(3);

CREATE UNIQUE INDEX "Usuario_tokenRedefinicaoSenhaHash_key"
ON "Usuario"("tokenRedefinicaoSenhaHash");
