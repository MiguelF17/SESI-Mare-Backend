"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const pushNotificationService_1 = require("../services/pushNotificationService");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
const tamanhoPagina = 50;
const marcadorMusica = /^\[\[mare-musica:(\d+)\]\]$/;
const marcadorPlaylist = /^\[\[mare-playlist:(\d+)\]\]$/;
async function seguemMutuamente(usuarioUmId, usuarioDoisId) {
    const relacoes = await prismaClient_1.default.seguidor.findMany({
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
function idMusicaDaMensagem(texto) {
    const resultado = texto.match(marcadorMusica);
    return resultado ? Number(resultado[1]) : null;
}
function idPlaylistDaMensagem(texto) {
    const resultado = texto.match(marcadorPlaylist);
    return resultado ? Number(resultado[1]) : null;
}
async function incluirMusicasCompartilhadas(mensagens) {
    const playlistIds = [...new Set(mensagens.map((m) => idPlaylistDaMensagem(m.texto)).filter((id) => id !== null))];
    const playlists = playlistIds.length ? await prismaClient_1.default.playlist.findMany({
        where: { id: { in: playlistIds }, publica: true },
        include: { usuario: { select: { id: true, nome: true, username: true, foto: true } }, musicas: { orderBy: { posicao: "asc" }, take: 15, include: { musica: { include: { artista: true } } } } },
    }) : [];
    const porPlaylist = new Map(playlists.map((item) => [item.id, item]));
    const ids = [...new Set(mensagens
            .map((mensagem) => idMusicaDaMensagem(mensagem.texto))
            .filter((id) => id !== null))];
    if (!ids.length)
        return mensagens.map((mensagem) => ({ ...mensagem, musica: null, playlist: porPlaylist.get(idPlaylistDaMensagem(mensagem.texto) ?? -1) ?? null }));
    const musicas = await prismaClient_1.default.musica.findMany({
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
router.get("/conversas/nao-lidas/quantidade", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const quantidade = await prismaClient_1.default.mensagemPrivada.count({
            where: {
                lidaEm: null,
                remetenteId: { not: req.usuarioId },
                conversa: {
                    is: {
                        OR: [{ usuarioUmId: req.usuarioId }, { usuarioDoisId: req.usuarioId }],
                    },
                },
            },
        });
        return res.status(200).json({ quantidade });
    }
    catch (error) {
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
function resumirConversa(conversa, usuarioId) {
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
router.get("/conversas", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const conversas = await prismaClient_1.default.conversaPrivada.findMany({
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
    }
    catch (error) {
        console.error("Erro ao listar conversas privadas:", error);
        return res.status(500).json({ error: "Não foi possível carregar suas conversas." });
    }
});
// Abre uma conversa existente ou cria uma conversa individual com outra pessoa.
router.post("/conversas", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const outroUsuarioId = Number(req.body?.usuarioId);
        if (!Number.isInteger(outroUsuarioId) || outroUsuarioId <= 0) {
            return res.status(400).json({ error: "Informe uma pessoa válida para iniciar a conversa." });
        }
        if (outroUsuarioId === usuarioId) {
            return res.status(400).json({ error: "Não é possível iniciar uma conversa com sua própria conta." });
        }
        const outroUsuarioExiste = await prismaClient_1.default.usuario.findUnique({
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
        const conversa = await prismaClient_1.default.conversaPrivada.upsert({
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
    }
    catch (error) {
        console.error("Erro ao abrir conversa privada:", error);
        return res.status(500).json({ error: "Não foi possível abrir a conversa." });
    }
});
// Devolve o estado de silenciamento e bloqueio da conversa para a pessoa autenticada.
router.get("/conversas/:id", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const conversaId = Number(req.params.id);
        const usuarioId = req.usuarioId;
        if (!Number.isInteger(conversaId) || conversaId <= 0) {
            return res.status(400).json({ error: "ID de conversa inválido." });
        }
        const conversa = await prismaClient_1.default.conversaPrivada.findFirst({
            where: { id: conversaId, OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }] },
        });
        if (!conversa)
            return res.status(404).json({ error: "Conversa não encontrada." });
        return res.status(200).json(resumirConversa({ ...conversa, mensagens: [], _count: { mensagens: 0 } }, usuarioId));
    }
    catch (error) {
        console.error("Erro ao consultar as configurações da conversa:", error);
        return res.status(500).json({ error: "Não foi possível carregar esta conversa." });
    }
});
// Altera o silenciamento ou bloqueio apenas para a conta autenticada.
router.patch("/conversas/:id/configuracoes", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const conversaId = Number(req.params.id);
        const usuarioId = req.usuarioId;
        if (!Number.isInteger(conversaId) || conversaId <= 0) {
            return res.status(400).json({ error: "ID de conversa inválido." });
        }
        if (typeof req.body?.silenciada !== "boolean" && typeof req.body?.bloqueada !== "boolean") {
            return res.status(400).json({ error: "Informe se deseja silenciar ou bloquear a conversa." });
        }
        const conversa = await prismaClient_1.default.conversaPrivada.findFirst({
            where: { id: conversaId, OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }] },
        });
        if (!conversa)
            return res.status(404).json({ error: "Conversa não encontrada." });
        const ehUsuarioUm = conversa.usuarioUmId === usuarioId;
        const alteracoes = {};
        if (typeof req.body.silenciada === "boolean") {
            alteracoes[ehUsuarioUm ? "silenciadaPorUm" : "silenciadaPorDois"] = req.body.silenciada;
        }
        if (typeof req.body.bloqueada === "boolean") {
            alteracoes[ehUsuarioUm ? "bloqueadaPorUm" : "bloqueadaPorDois"] = req.body.bloqueada;
        }
        const atualizada = await prismaClient_1.default.conversaPrivada.update({
            where: { id: conversaId },
            data: alteracoes,
        });
        return res.status(200).json(resumirConversa({ ...atualizada, mensagens: [], _count: { mensagens: 0 } }, usuarioId));
    }
    catch (error) {
        console.error("Erro ao atualizar as configurações da conversa:", error);
        return res.status(500).json({ error: "Não foi possível atualizar esta conversa." });
    }
});
// Retorna recibos enxutos das últimas mensagens enviadas por quem consulta.
router.get("/conversas/:id/leituras", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const conversaId = Number(req.params.id);
        const usuarioId = req.usuarioId;
        if (!Number.isInteger(conversaId) || conversaId <= 0) {
            return res.status(400).json({ error: "ID de conversa inválido." });
        }
        const pertence = await prismaClient_1.default.conversaPrivada.findFirst({
            where: { id: conversaId, OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }] },
            select: { id: true },
        });
        if (!pertence)
            return res.status(404).json({ error: "Conversa não encontrada." });
        const mensagensLidas = await prismaClient_1.default.mensagemPrivada.findMany({
            where: { conversaId, remetenteId: usuarioId, lidaEm: { not: null } },
            take: tamanhoPagina,
            orderBy: { id: "desc" },
            select: { id: true },
        });
        return res.status(200).json({ ids: mensagensLidas.map(({ id }) => id) });
    }
    catch (error) {
        console.error("Erro ao buscar recibos de leitura:", error);
        return res.status(500).json({ error: "Não foi possível atualizar os recibos de leitura." });
    }
});
// Busca as mensagens recentes ou somente as novas após um ID já recebido.
router.get("/conversas/:id/mensagens", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const conversaId = Number(req.params.id);
        const usuarioId = req.usuarioId;
        const depoisDe = req.query.depoisDe == null ? null : Number(req.query.depoisDe);
        if (!Number.isInteger(conversaId) || conversaId <= 0) {
            return res.status(400).json({ error: "ID de conversa inválido." });
        }
        if (depoisDe !== null && (!Number.isInteger(depoisDe) || depoisDe <= 0)) {
            return res.status(400).json({ error: "Ponto de atualização inválido." });
        }
        const pertence = await prismaClient_1.default.conversaPrivada.findFirst({
            where: {
                id: conversaId,
                OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }],
            },
            select: { id: true },
        });
        if (!pertence)
            return res.status(404).json({ error: "Conversa não encontrada." });
        const incluirRemetente = { remetente: { select: selecaoUsuario } };
        const mensagens = depoisDe === null
            ? await prismaClient_1.default.mensagemPrivada.findMany({
                where: { conversaId },
                take: tamanhoPagina,
                orderBy: { id: "desc" },
                include: incluirRemetente,
            })
            : await prismaClient_1.default.mensagemPrivada.findMany({
                where: { conversaId, id: { gt: depoisDe } },
                orderBy: { id: "asc" },
                include: incluirRemetente,
            });
        const mensagensOrdenadas = depoisDe === null ? mensagens.reverse() : mensagens;
        return res.status(200).json(await incluirMusicasCompartilhadas(mensagensOrdenadas));
    }
    catch (error) {
        console.error("Erro ao buscar mensagens privadas:", error);
        return res.status(500).json({ error: "Não foi possível carregar as mensagens." });
    }
});
// Envia texto simples. Somente os dois participantes podem enviar mensagens.
router.post("/conversas/:id/mensagens", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const conversaId = Number(req.params.id);
        const usuarioId = req.usuarioId;
        const textoNormal = typeof req.body?.texto === "string" ? req.body.texto.trim() : "";
        const musicaId = req.body?.musicaId == null ? null : Number(req.body.musicaId);
        const playlistId = req.body?.playlistId == null ? null : Number(req.body.playlistId);
        if (!Number.isInteger(conversaId) || conversaId <= 0) {
            return res.status(400).json({ error: "ID de conversa inválido." });
        }
        if (musicaId === null && playlistId === null && !textoNormal)
            return res.status(400).json({ error: "Escreva uma mensagem." });
        if (playlistId !== null && (!Number.isSafeInteger(playlistId) || playlistId <= 0))
            return res.status(400).json({ error: "Selecione uma playlist válida." });
        if (musicaId !== null && (!Number.isSafeInteger(musicaId) || musicaId <= 0)) {
            return res.status(400).json({ error: "Selecione uma música válida." });
        }
        if (textoNormal.length > 2000)
            return res.status(400).json({ error: "A mensagem pode ter no máximo 2.000 caracteres." });
        const conversa = await prismaClient_1.default.conversaPrivada.findFirst({
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
        if (!conversa)
            return res.status(404).json({ error: "Conversa não encontrada." });
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
            musicaCompartilhada = await prismaClient_1.default.musica.findUnique({
                where: { id: musicaId },
                select: { id: true, titulo: true, capa: true, artista: { select: { id: true, nome: true } } },
            });
            if (!musicaCompartilhada)
                return res.status(404).json({ error: "Música não encontrada." });
        }
        if (playlistId !== null) {
            playlistCompartilhada = await prismaClient_1.default.playlist.findFirst({ where: { id: playlistId, usuarioId, publica: true }, include: { usuario: { select: { id: true, nome: true, username: true, foto: true } }, musicas: { orderBy: { posicao: "asc" }, take: 15, include: { musica: { include: { artista: true } } } } } });
            if (!playlistCompartilhada)
                return res.status(404).json({ error: "Playlist pública não encontrada." });
        }
        const texto = musicaId !== null ? `[[mare-musica:${musicaId}]]` : playlistId !== null ? `[[mare-playlist:${playlistId}]]` : textoNormal;
        const [mensagem] = await prismaClient_1.default.$transaction([
            prismaClient_1.default.mensagemPrivada.create({
                data: { conversaId, remetenteId: usuarioId, texto },
                include: { remetente: { select: selecaoUsuario } },
            }),
            prismaClient_1.default.conversaPrivada.update({
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
        if (!destinatarioSilenciou)
            void (0, pushNotificationService_1.enviarPushParaUsuario)(destinatarioId, {
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
    }
    catch (error) {
        console.error("Erro ao enviar mensagem privada:", error);
        return res.status(500).json({ error: "Não foi possível enviar a mensagem." });
    }
});
router.patch("/conversas/:id/lidas", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const conversaId = Number(req.params.id);
        const usuarioId = req.usuarioId;
        if (!Number.isInteger(conversaId) || conversaId <= 0) {
            return res.status(400).json({ error: "ID de conversa inválido." });
        }
        const conversa = await prismaClient_1.default.conversaPrivada.findFirst({
            where: {
                id: conversaId,
                OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }],
            },
            select: { id: true },
        });
        if (!conversa)
            return res.status(404).json({ error: "Conversa não encontrada." });
        const resultado = await prismaClient_1.default.mensagemPrivada.updateMany({
            where: { conversaId, remetenteId: { not: usuarioId }, lidaEm: null },
            data: { lidaEm: new Date() },
        });
        return res.status(200).json({ atualizadas: resultado.count });
    }
    catch (error) {
        console.error("Erro ao marcar mensagens como lidas:", error);
        return res.status(500).json({ error: "Não foi possível atualizar as mensagens." });
    }
});
exports.default = router;
