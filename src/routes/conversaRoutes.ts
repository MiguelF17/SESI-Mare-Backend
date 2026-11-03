import { Response, Router } from "express";
import prisma from "../prismaClient";
import { enviarPushParaUsuario } from "../services/pushNotificationService";
import { AuthRequest, authMiddleware } from "../middleware/authMiddleware";

const router = Router();
const tamanhoPagina = 50;
const marcadorMusica = /^\[\[mare-musica:(\d+)\]\]$/;
const marcadorPlaylist = /^\[\[mare-playlist:(\d+)\]\]$/;

async function seguemMutuamente(usuarioUmId: number, usuarioDoisId: number) {
  const relacoes = await prisma.seguidor.findMany({
    where: {
      OR: [
        { seguidorId: usuarioUmId, seguidoId: usuarioDoisId },
        { seguidorId: usuarioDoisId, seguidoId: usuarioUmId },
      ],
    },
    select: { seguidorId: true, seguidoId: true },
  });
  return relacoes.length === 2;
}

function idMusicaDaMensagem(texto: string) {
  const resultado = texto.match(marcadorMusica);
  return resultado ? Number(resultado[1]) : null;
}

function idPlaylistDaMensagem(texto: string) {
  const resultado = texto.match(marcadorPlaylist);
  return resultado ? Number(resultado[1]) : null;
}

async function incluirMusicasCompartilhadas(mensagens: any[]) {
  const playlistIds = [...new Set(mensagens.map((m) => idPlaylistDaMensagem(m.texto)).filter((id): id is number => id !== null))];
  const playlists = playlistIds.length ? await prisma.playlist.findMany({
    where: { id: { in: playlistIds }, publica: true },
    include: { usuario: { select: { id: true, nome: true, username: true, foto: true } }, musicas: { orderBy: { posicao: "asc" }, include: { musica: { include: { artista: true } } } } },
  }) : [];
  const porPlaylist = new Map(playlists.map((item) => [item.id, item]));
  const ids = [...new Set(mensagens
    .map((mensagem) => idMusicaDaMensagem(mensagem.texto))
    .filter((id): id is number => id !== null))];
  if (!ids.length) return mensagens.map((mensagem) => ({ ...mensagem, musica: null, playlist: porPlaylist.get(idPlaylistDaMensagem(mensagem.texto) ?? -1) ?? null }));

  const musicas = await prisma.musica.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      titulo: true,
      capa: true,
      artista: { select: { id: true, nome: true } },
    },
  });
  const porId = new Map(musicas.map((musica) => [musica.id, musica]));

  return mensagens.map((mensagem) => {
    const musicaId = idMusicaDaMensagem(mensagem.texto);
    const playlistId = idPlaylistDaMensagem(mensagem.texto);
    return { ...mensagem, musica: musicaId ? porId.get(musicaId) ?? null : null, playlist: playlistId ? porPlaylist.get(playlistId) ?? null : null };
  });
}

// Contagem enxuta para o indicador de mensagens não lidas na navbar.
router.get("/conversas/nao-lidas/quantidade", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const quantidade = await prisma.mensagemPrivada.count({
      where: {
        lidaEm: null,
        remetenteId: { not: req.usuarioId! },
        conversa: {
          is: {
            OR: [{ usuarioUmId: req.usuarioId! }, { usuarioDoisId: req.usuarioId! }],
          },
        },
      },
    });
    return res.status(200).json({ quantidade });
  } catch (error) {
    console.error("Erro ao contar mensagens não lidas:", error);
    return res.status(500).json({ error: "Não foi possível contar as mensagens não lidas." });
  }
});

const selecaoUsuario = {
  id: true,
  nome: true,
  username: true,
  foto: true,
};

function resumirConversa(conversa: any, usuarioId: number) {
  const outroUsuario = conversa.usuarioUmId === usuarioId
    ? conversa.usuarioDois
    : conversa.usuarioUm;

  const ehUsuarioUm = conversa.usuarioUmId === usuarioId;
  const ultimaMensagem = conversa.mensagens[0] ?? null;

  return {
    id: conversa.id,
    criadaEm: conversa.criadaEm,
    atualizadaEm: conversa.atualizadaEm,
    outroUsuario,
    ultimaMensagem: ultimaMensagem
      ? {
          ...ultimaMensagem,
          texto: idMusicaDaMensagem(ultimaMensagem.texto)
            ? "🎵 Música compartilhada"
            : ultimaMensagem.texto,
        }
      : null,
    mensagensNaoLidas: conversa._count.mensagens,
    silenciadaPorMim: ehUsuarioUm ? conversa.silenciadaPorUm : conversa.silenciadaPorDois,
    bloqueadaPorMim: ehUsuarioUm ? conversa.bloqueadaPorUm : conversa.bloqueadaPorDois,
    bloqueadaPeloOutro: ehUsuarioUm ? conversa.bloqueadaPorDois : conversa.bloqueadaPorUm,
  };
}

// Lista apenas as conversas das quais o usuário autenticado participa.
router.get("/conversas", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const usuarioId = req.usuarioId!;
    const conversas = await prisma.conversaPrivada.findMany({
      where: { OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }] },
      include: {
        usuarioUm: { select: selecaoUsuario },
        usuarioDois: { select: selecaoUsuario },
        mensagens: {
          take: 1,
          orderBy: { id: "desc" },
          select: { id: true, texto: true, remetenteId: true, criadaEm: true, lidaEm: true },
        },
        _count: {
          select: {
            mensagens: {
              where: { remetenteId: { not: usuarioId }, lidaEm: null },
            },
          },
        },
      },
      orderBy: { atualizadaEm: "desc" },
    });

    return res.status(200).json(conversas.map((conversa) => resumirConversa(conversa, usuarioId)));
  } catch (error) {
    console.error("Erro ao listar conversas privadas:", error);
    return res.status(500).json({ error: "Não foi possível carregar suas conversas." });
  }
});

// Abre uma conversa existente ou cria uma conversa individual com outra pessoa.
router.post("/conversas", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const usuarioId = req.usuarioId!;
    const outroUsuarioId = Number(req.body?.usuarioId);

    if (!Number.isInteger(outroUsuarioId) || outroUsuarioId <= 0) {
      return res.status(400).json({ error: "Informe uma pessoa válida para iniciar a conversa." });
    }
    if (outroUsuarioId === usuarioId) {
      return res.status(400).json({ error: "Não é possível iniciar uma conversa com sua própria conta." });
    }

    const outroUsuarioExiste = await prisma.usuario.findUnique({
      where: { id: outroUsuarioId },
      select: { id: true },
    });
    if (!outroUsuarioExiste) {
      return res.status(404).json({ error: "Pessoa não encontrada." });
    }
    if (!(await seguemMutuamente(usuarioId, outroUsuarioId))) {
      return res.status(403).json({ error: "Para conversar, vocês precisam seguir um ao outro." });
    }

    const [usuarioUmId, usuarioDoisId] = [usuarioId, outroUsuarioId].sort((a, b) => a - b);
    const conversa = await prisma.conversaPrivada.upsert({
      where: { usuarioUmId_usuarioDoisId: { usuarioUmId, usuarioDoisId } },
      update: {},
      create: { usuarioUmId, usuarioDoisId },
      include: {
        usuarioUm: { select: selecaoUsuario },
        usuarioDois: { select: selecaoUsuario },
        mensagens: {
          take: 1,
          orderBy: { id: "desc" },
          select: { id: true, texto: true, remetenteId: true, criadaEm: true, lidaEm: true },
        },
        _count: {
          select: {
            mensagens: {
              where: { remetenteId: { not: usuarioId }, lidaEm: null },
            },
          },
        },
      },
    });

    return res.status(200).json(resumirConversa(conversa, usuarioId));
  } catch (error) {
    console.error("Erro ao abrir conversa privada:", error);
    return res.status(500).json({ error: "Não foi possível abrir a conversa." });
  }
});

// Devolve o estado de silenciamento e bloqueio da conversa para a pessoa autenticada.
router.get("/conversas/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const conversaId = Number(req.params.id);
    const usuarioId = req.usuarioId!;
    if (!Number.isInteger(conversaId) || conversaId <= 0) {
      return res.status(400).json({ error: "ID de conversa inválido." });
    }

    const conversa = await prisma.conversaPrivada.findFirst({
      where: { id: conversaId, OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }] },
    });
    if (!conversa) return res.status(404).json({ error: "Conversa não encontrada." });
    return res.status(200).json(resumirConversa({ ...conversa, mensagens: [], _count: { mensagens: 0 } }, usuarioId));
  } catch (error) {
    console.error("Erro ao consultar as configurações da conversa:", error);
    return res.status(500).json({ error: "Não foi possível carregar esta conversa." });
  }
});

// Altera o silenciamento ou bloqueio apenas para a conta autenticada.
router.patch("/conversas/:id/configuracoes", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const conversaId = Number(req.params.id);
    const usuarioId = req.usuarioId!;
    if (!Number.isInteger(conversaId) || conversaId <= 0) {
      return res.status(400).json({ error: "ID de conversa inválido." });
    }
    if (typeof req.body?.silenciada !== "boolean" && typeof req.body?.bloqueada !== "boolean") {
      return res.status(400).json({ error: "Informe se deseja silenciar ou bloquear a conversa." });
    }

    const conversa = await prisma.conversaPrivada.findFirst({
      where: { id: conversaId, OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }] },
    });
    if (!conversa) return res.status(404).json({ error: "Conversa não encontrada." });

    const ehUsuarioUm = conversa.usuarioUmId === usuarioId;
    const alteracoes: Record<string, boolean> = {};
    if (typeof req.body.silenciada === "boolean") {
      alteracoes[ehUsuarioUm ? "silenciadaPorUm" : "silenciadaPorDois"] = req.body.silenciada;
    }
    if (typeof req.body.bloqueada === "boolean") {
      alteracoes[ehUsuarioUm ? "bloqueadaPorUm" : "bloqueadaPorDois"] = req.body.bloqueada;
    }

    const atualizada = await prisma.conversaPrivada.update({
      where: { id: conversaId },
      data: alteracoes,
    });
    return res.status(200).json(resumirConversa({ ...atualizada, mensagens: [], _count: { mensagens: 0 } }, usuarioId));
  } catch (error) {
    console.error("Erro ao atualizar as configurações da conversa:", error);
    return res.status(500).json({ error: "Não foi possível atualizar esta conversa." });
  }
});

// Retorna recibos enxutos das últimas mensagens enviadas por quem consulta.
router.get("/conversas/:id/leituras", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const conversaId = Number(req.params.id);
    const usuarioId = req.usuarioId!;
    if (!Number.isInteger(conversaId) || conversaId <= 0) {
      return res.status(400).json({ error: "ID de conversa inválido." });
    }

    const pertence = await prisma.conversaPrivada.findFirst({
      where: { id: conversaId, OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }] },
      select: { id: true },
    });
    if (!pertence) return res.status(404).json({ error: "Conversa não encontrada." });

    const mensagensLidas = await prisma.mensagemPrivada.findMany({
      where: { conversaId, remetenteId: usuarioId, lidaEm: { not: null } },
      take: tamanhoPagina,
      orderBy: { id: "desc" },
      select: { id: true },
    });
    return res.status(200).json({ ids: mensagensLidas.map(({ id }) => id) });
  } catch (error) {
    console.error("Erro ao buscar recibos de leitura:", error);
    return res.status(500).json({ error: "Não foi possível atualizar os recibos de leitura." });
  }
});

// Busca as mensagens recentes ou somente as novas após um ID já recebido.
router.get("/conversas/:id/mensagens", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const conversaId = Number(req.params.id);
    const usuarioId = req.usuarioId!;
    const depoisDe = req.query.depoisDe == null ? null : Number(req.query.depoisDe);

    if (!Number.isInteger(conversaId) || conversaId <= 0) {
      return res.status(400).json({ error: "ID de conversa inválido." });
    }
    if (depoisDe !== null && (!Number.isInteger(depoisDe) || depoisDe <= 0)) {
      return res.status(400).json({ error: "Ponto de atualização inválido." });
    }

    const pertence = await prisma.conversaPrivada.findFirst({
      where: {
        id: conversaId,
        OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }],
      },
      select: { id: true },
    });
    if (!pertence) return res.status(404).json({ error: "Conversa não encontrada." });

    const incluirRemetente = { remetente: { select: selecaoUsuario } };
    const mensagens = depoisDe === null
      ? await prisma.mensagemPrivada.findMany({
          where: { conversaId },
          take: tamanhoPagina,
          orderBy: { id: "desc" },
          include: incluirRemetente,
        })
      : await prisma.mensagemPrivada.findMany({
          where: { conversaId, id: { gt: depoisDe } },
          orderBy: { id: "asc" },
          include: incluirRemetente,
        });

    const mensagensOrdenadas = depoisDe === null ? mensagens.reverse() : mensagens;
    return res.status(200).json(await incluirMusicasCompartilhadas(mensagensOrdenadas));
  } catch (error) {
    console.error("Erro ao buscar mensagens privadas:", error);
    return res.status(500).json({ error: "Não foi possível carregar as mensagens." });
  }
});

// Envia texto simples. Somente os dois participantes podem enviar mensagens.
router.post("/conversas/:id/mensagens", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const conversaId = Number(req.params.id);
    const usuarioId = req.usuarioId!;
    const textoNormal = typeof req.body?.texto === "string" ? req.body.texto.trim() : "";
    const musicaId = req.body?.musicaId == null ? null : Number(req.body.musicaId);
    const playlistId = req.body?.playlistId == null ? null : Number(req.body.playlistId);

    if (!Number.isInteger(conversaId) || conversaId <= 0) {
      return res.status(400).json({ error: "ID de conversa inválido." });
    }
    if (musicaId === null && playlistId === null && !textoNormal) return res.status(400).json({ error: "Escreva uma mensagem." });
    if (playlistId !== null && (!Number.isSafeInteger(playlistId) || playlistId <= 0)) return res.status(400).json({ error: "Selecione uma playlist válida." });
    if (musicaId !== null && (!Number.isSafeInteger(musicaId) || musicaId <= 0)) {
      return res.status(400).json({ error: "Selecione uma música válida." });
    }
    if (textoNormal.length > 2000) return res.status(400).json({ error: "A mensagem pode ter no máximo 2.000 caracteres." });

    const conversa = await prisma.conversaPrivada.findFirst({
      where: {
        id: conversaId,
        OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }],
      },
      select: {
        id: true,
        usuarioUmId: true,
        usuarioDoisId: true,
        bloqueadaPorUm: true,
        bloqueadaPorDois: true,
        silenciadaPorUm: true,
        silenciadaPorDois: true,
      },
    });
    if (!conversa) return res.status(404).json({ error: "Conversa não encontrada." });
    const outroUsuarioId = conversa.usuarioUmId === usuarioId ? conversa.usuarioDoisId : conversa.usuarioUmId;
    if (!(await seguemMutuamente(usuarioId, outroUsuarioId))) {
      return res.status(403).json({ error: "Para enviar mensagens, vocês precisam seguir um ao outro." });
    }
    if (conversa.bloqueadaPorUm || conversa.bloqueadaPorDois) {
      return res.status(403).json({ error: "Esta conversa está bloqueada e não pode receber mensagens." });
    }

    let musicaCompartilhada = null;
    let playlistCompartilhada = null;
    if (musicaId !== null) {
      musicaCompartilhada = await prisma.musica.findUnique({
        where: { id: musicaId },
        select: { id: true, titulo: true, capa: true, artista: { select: { id: true, nome: true } } },
      });
      if (!musicaCompartilhada) return res.status(404).json({ error: "Música não encontrada." });
    }
    if (playlistId !== null) {
      playlistCompartilhada = await prisma.playlist.findFirst({ where: { id: playlistId, usuarioId, publica: true }, include: { usuario: { select: { id: true, nome: true, username: true, foto: true } }, musicas: { orderBy: { posicao: "asc" }, include: { musica: { include: { artista: true } } } } } });
      if (!playlistCompartilhada) return res.status(404).json({ error: "Playlist pública não encontrada." });
    }
    const texto = musicaId !== null ? `[[mare-musica:${musicaId}]]` : playlistId !== null ? `[[mare-playlist:${playlistId}]]` : textoNormal;

    const [mensagem] = await prisma.$transaction([
      prisma.mensagemPrivada.create({
        data: { conversaId, remetenteId: usuarioId, texto },
        include: { remetente: { select: selecaoUsuario } },
      }),
      prisma.conversaPrivada.update({
        where: { id: conversaId },
        data: { atualizadaEm: new Date() },
      }),
    ]);

    const destinatarioId = usuarioId === conversa.usuarioUmId
      ? conversa.usuarioDoisId
      : conversa.usuarioUmId;
    const mensagemComMusica = { ...mensagem, musica: musicaCompartilhada, playlist: playlistCompartilhada };
    const destinatarioSilenciou = destinatarioId === conversa.usuarioUmId
      ? conversa.silenciadaPorUm
      : conversa.silenciadaPorDois;
    if (!destinatarioSilenciou) void enviarPushParaUsuario(destinatarioId, {
      titulo: `Mensagem de ${mensagem.remetente.nome}`,
      corpo: musicaCompartilhada
        ? `Compartilhou: ${musicaCompartilhada.titulo} — ${musicaCompartilhada.artista.nome}`
        : playlistCompartilhada ? `Compartilhou a playlist ${playlistCompartilhada.nome}`
        : mensagem.texto,
      imagem: mensagem.remetente.foto,
      categoria: "mare_mensagem",
      dados: {
        tipo: "mensagem",
        conversaId,
        nome: mensagem.remetente.nome,
        username: mensagem.remetente.username,
        foto: mensagem.remetente.foto ?? "",
      },
    });

    return res.status(201).json(mensagemComMusica);
  } catch (error) {
    console.error("Erro ao enviar mensagem privada:", error);
    return res.status(500).json({ error: "Não foi possível enviar a mensagem." });
  }
});

router.patch("/conversas/:id/lidas", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const conversaId = Number(req.params.id);
    const usuarioId = req.usuarioId!;
    if (!Number.isInteger(conversaId) || conversaId <= 0) {
      return res.status(400).json({ error: "ID de conversa inválido." });
    }

    const conversa = await prisma.conversaPrivada.findFirst({
      where: {
        id: conversaId,
        OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }],
      },
      select: { id: true },
    });
    if (!conversa) return res.status(404).json({ error: "Conversa não encontrada." });

    const resultado = await prisma.mensagemPrivada.updateMany({
      where: { conversaId, remetenteId: { not: usuarioId }, lidaEm: null },
      data: { lidaEm: new Date() },
    });
    return res.status(200).json({ atualizadas: resultado.count });
  } catch (error) {
    console.error("Erro ao marcar mensagens como lidas:", error);
    return res.status(500).json({ error: "Não foi possível atualizar as mensagens." });
  }
});

export default router;
