CREATE TABLE "Playlist" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "descricao" VARCHAR(240),
    "publica" BOOLEAN NOT NULL DEFAULT false,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlaylistMusica" (
    "playlistId" INTEGER NOT NULL,
    "musicaId" INTEGER NOT NULL,
    "posicao" INTEGER NOT NULL DEFAULT 0,
    "adicionadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaylistMusica_pkey" PRIMARY KEY ("playlistId", "musicaId")
);

CREATE INDEX "Playlist_usuarioId_atualizadaEm_idx" ON "Playlist"("usuarioId", "atualizadaEm");
CREATE INDEX "Playlist_publica_atualizadaEm_idx" ON "Playlist"("publica", "atualizadaEm");
CREATE INDEX "PlaylistMusica_playlistId_posicao_idx" ON "PlaylistMusica"("playlistId", "posicao");

ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistMusica" ADD CONSTRAINT "PlaylistMusica_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistMusica" ADD CONSTRAINT "PlaylistMusica_musicaId_fkey" FOREIGN KEY ("musicaId") REFERENCES "Musica"("id") ON DELETE CASCADE ON UPDATE CASCADE;
