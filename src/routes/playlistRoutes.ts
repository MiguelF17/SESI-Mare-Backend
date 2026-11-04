import { Response, Router } from "express";
import prisma from "../prismaClient";
import { AuthRequest, authMiddleware } from "../middleware/authMiddleware";

const router = Router();
const incluirPlaylist = {
  musicas: {
    orderBy: { posicao: "asc" as const },
    include: { musica: { include: { artista: true } } },
  },
  usuario: { select: { id: true, nome: true, username: true, foto: true } },
};

router.get("/usuarios/me/playlists", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playlists = await prisma.playlist.findMany({ where: { usuarioId: req.usuarioId! }, include: incluirPlaylist, orderBy: { atualizadaEm: "desc" } });
    return res.json(playlists);
  } catch (error) {
    console.error("Erro ao listar playlists:", error);
    return res.status(500).json({ error: "Não foi possível carregar suas playlists." });
  }
});

router.get("/usuarios/publico/:username/playlists", async (req, res) => {
  try {
    const playlists = await prisma.playlist.findMany({
      where: { publica: true, usuario: { username: String(req.params.username) } },
      include: incluirPlaylist,
      orderBy: { atualizadaEm: "desc" },
    });
    return res.json(playlists);
  } catch (error) {
    console.error("Erro ao carregar playlists públicas:", error);
    return res.status(500).json({ error: "Não foi possível carregar as playlists públicas." });
  }
});

router.get("/playlists/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Playlist inválida." });
    const playlist = await prisma.playlist.findFirst({ where: { id, OR: [{ publica: true }, { usuarioId: req.usuarioId! }] }, include: incluirPlaylist });
    if (!playlist) return res.status(404).json({ error: "Playlist não encontrada." });
    return res.json(playlist);
  } catch (error) {
    console.error("Erro ao buscar playlist:", error);
    return res.status(500).json({ error: "Não foi possível abrir esta playlist." });
  }
});

router.post("/playlists", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const nome = typeof req.body?.nome === "string" ? req.body.nome.trim() : "";
    const descricao = typeof req.body?.descricao === "string" ? req.body.descricao.trim() : "";
    const publica = req.body?.publica === true;
    if (!nome || nome.length > 80) return res.status(400).json({ error: "O nome deve ter entre 1 e 80 caracteres." });
    if (descricao.length > 240) return res.status(400).json({ error: "A descrição pode ter no máximo 240 caracteres." });
    const playlist = await prisma.playlist.create({ data: { usuarioId: req.usuarioId!, nome, descricao: descricao || null, publica }, include: incluirPlaylist });
    return res.status(201).json(playlist);
  } catch (error) {
    console.error("Erro ao criar playlist:", error);
    return res.status(500).json({ error: "Não foi possível criar a playlist." });
  }
});

router.patch("/playlists/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const nome = typeof req.body?.nome === "string" ? req.body.nome.trim() : undefined;
    const descricao = typeof req.body?.descricao === "string" ? req.body.descricao.trim() : undefined;
    const publica = typeof req.body?.publica === "boolean" ? req.body.publica : undefined;
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Playlist inválida." });
    if (nome !== undefined && (!nome || nome.length > 80)) return res.status(400).json({ error: "O nome deve ter entre 1 e 80 caracteres." });
    if (descricao !== undefined && descricao.length > 240) return res.status(400).json({ error: "A descrição pode ter no máximo 240 caracteres." });
    const atualizada = await prisma.playlist.update({ where: { id, usuarioId: req.usuarioId! }, data: { ...(nome !== undefined ? { nome } : {}), ...(descricao !== undefined ? { descricao: descricao || null } : {}), ...(publica !== undefined ? { publica } : {}) }, include: incluirPlaylist });
    return res.json(atualizada);
  } catch (error) {
    console.error("Erro ao editar playlist:", error);
    return res.status(404).json({ error: "Playlist não encontrada ou sem permissão para editar." });
  }
});

router.post("/playlists/:id/musicas", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = Number(req.params.id);
    const musicaId = Number(req.body?.musicaId);
    if (!Number.isSafeInteger(playlistId) || playlistId <= 0 || !Number.isSafeInteger(musicaId) || musicaId <= 0) return res.status(400).json({ error: "Playlist ou música inválida." });
    const playlist = await prisma.playlist.findFirst({ where: { id: playlistId, usuarioId: req.usuarioId! }, select: { id: true } });
    if (!playlist) return res.status(404).json({ error: "Playlist não encontrada ou sem permissão para editar." });
    const atualizada = await prisma.$transaction(async (transacao) => {
      const existente = await transacao.playlistMusica.findUnique({
        where: { playlistId_musicaId: { playlistId, musicaId } },
        select: { musicaId: true },
      });
      if (!existente) {
        const quantidadeAtual = await transacao.playlistMusica.count({ where: { playlistId } });
        if (quantidadeAtual >= 15) return null;

        const ultima = await transacao.playlistMusica.aggregate({ where: { playlistId }, _max: { posicao: true } });
        await transacao.playlistMusica.create({
          data: { playlistId, musicaId, posicao: (ultima._max.posicao ?? -1) + 1 },
        });
      }
      return transacao.playlist.findUnique({ where: { id: playlistId }, include: incluirPlaylist });
    }, { isolationLevel: "Serializable" });
    if (!atualizada) return res.status(409).json({ error: "Cada playlist pode ter no máximo 15 músicas." });
    return res.status(201).json(atualizada);
  } catch (error) {
    console.error("Erro ao adicionar música à playlist:", error);
    return res.status(400).json({ error: "Não foi possível adicionar esta música." });
  }
});

router.delete("/playlists/:id/musicas/:musicaId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = Number(req.params.id);
    const musicaId = Number(req.params.musicaId);
    const playlist = await prisma.playlist.findFirst({ where: { id: playlistId, usuarioId: req.usuarioId! }, select: { id: true } });
    if (!playlist) return res.status(404).json({ error: "Playlist não encontrada ou sem permissão para editar." });
    await prisma.playlistMusica.deleteMany({ where: { playlistId, musicaId } });
    return res.status(204).end();
  } catch (error) {
    console.error("Erro ao remover música da playlist:", error);
    return res.status(500).json({ error: "Não foi possível remover a música." });
  }
});

router.delete("/playlists/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await prisma.playlist.delete({ where: { id, usuarioId: req.usuarioId! } });
    return res.status(204).end();
  } catch (error) {
    console.error("Erro ao excluir playlist:", error);
    return res.status(404).json({ error: "Playlist não encontrada ou sem permissão para excluir." });
  }
});

export default router;
