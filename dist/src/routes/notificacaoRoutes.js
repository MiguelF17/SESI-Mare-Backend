"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Devolve somente a contagem para o badge da navegação, sem carregar os detalhes.
router.get("/notificacoes/nao-lidas/quantidade", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const quantidade = await prismaClient_1.default.notificacao.count({
            where: { usuarioId: req.usuarioId, lida: false },
        });
        return res.status(200).json({ quantidade });
    }
    catch (erro) {
        console.error("Erro ao contar notificações não lidas:", erro);
        return res.status(500).json({ erro: "Não foi possível contar as notificações." });
    }
});
// Informa se este aparelho está ativo sem alterar o registro.
router.get("/notificacoes/push-token", authMiddleware_1.authMiddleware, async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token)
        return res.status(400).json({ erro: "Informe o token do aparelho." });
    try {
        const registro = await prismaClient_1.default.tokenNotificacaoPush.findFirst({
            where: { usuarioId: req.usuarioId, token },
            select: { id: true },
        });
        return res.status(200).json({ ativado: Boolean(registro) });
    }
    catch (erro) {
        console.error("Erro ao consultar registro push:", erro);
        return res.status(500).json({ erro: "Não foi possível consultar notificações neste aparelho." });
    }
});
// Registra o aparelho atual para receber alertas push da conta autenticada.
router.post("/notificacoes/push-token", authMiddleware_1.authMiddleware, async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const plataforma = req.body?.plataforma === "android" || req.body?.plataforma === "ios"
        ? req.body.plataforma
        : null;
    if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token) || !plataforma) {
        return res.status(400).json({ erro: "Token ou plataforma inválidos." });
    }
    try {
        await prismaClient_1.default.tokenNotificacaoPush.upsert({
            where: { token },
            update: { usuarioId: req.usuarioId, plataforma },
            create: { usuarioId: req.usuarioId, token, plataforma },
        });
        return res.status(200).json({ mensagem: "Este aparelho foi registrado." });
    }
    catch (erro) {
        console.error("Erro ao registrar token push:", erro);
        return res.status(500).json({ erro: "Não foi possível registrar este aparelho." });
    }
});
// Desativa o envio para este aparelho sem revogar a permissão do sistema.
router.delete("/notificacoes/push-token", authMiddleware_1.authMiddleware, async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!token)
        return res.status(400).json({ erro: "Informe o token do aparelho." });
    try {
        await prismaClient_1.default.tokenNotificacaoPush.deleteMany({
            where: { usuarioId: req.usuarioId, token },
        });
        return res.status(200).json({ mensagem: "Notificações desativadas neste aparelho." });
    }
    catch (erro) {
        console.error("Erro ao remover token push:", erro);
        return res.status(500).json({ erro: "Não foi possível desativar notificações neste aparelho." });
    }
});
// Lista as notificações do usuário logado.
router.get("/notificacoes", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const paginar = req.query.pagina === "true";
        const antes = req.query.antes;
        const idAnterior = typeof antes === "string" && /^\d+$/.test(antes)
            ? Number(antes)
            : undefined;
        if (paginar && antes !== undefined &&
            (!idAnterior || idAnterior > 2147483647)) {
            return res.status(400).json({ erro: "Cursor de notificações inválido." });
        }
        const tamanhoPagina = 20;
        const where = {
            usuarioId,
            ...(paginar && req.query.naoLidas === "true" ? { lida: false } : {}),
            ...(paginar && idAnterior !== undefined ? { id: { lt: idAnterior } } : {}),
        };
        const [notificacoes, quantidadeNaoLidas] = await Promise.all([
            prismaClient_1.default.notificacao.findMany({
                where,
                include: {
                    ator: { select: { id: true, nome: true, username: true, foto: true } },
                },
                orderBy: paginar ? { id: "desc" } : { criadaEm: "desc" },
                take: paginar ? tamanhoPagina + 1 : undefined,
            }),
            paginar ? prismaClient_1.default.notificacao.count({ where: { usuarioId, lida: false } }) : null,
        ]);
        const pagina = paginar ? notificacoes.slice(0, tamanhoPagina) : notificacoes;
        const idsPosts = [...new Set(pagina.flatMap(({ postId }) => postId ? [postId] : []))];
        const idsComentarios = [...new Set(pagina.flatMap(({ comentarioId, tipo }) => comentarioId && (tipo === "comentario" || tipo === "mencao") ? [comentarioId] : []))];
        const [posts, comentarios] = await Promise.all([
            idsPosts.length ? prismaClient_1.default.post.findMany({
                where: { id: { in: idsPosts } },
                select: {
                    id: true, texto: true, nota: true, editado: true,
                    musica: {
                        select: {
                            id: true, titulo: true, capa: true,
                            artista: { select: { nome: true } },
                        },
                    },
                    usuario: { select: { id: true, nome: true, username: true, foto: true } },
                },
            }) : [],
            idsComentarios.length ? prismaClient_1.default.comentario.findMany({
                where: { id: { in: idsComentarios } },
                select: { id: true, texto: true },
            }) : [],
        ]);
        const postsPorId = new Map(posts.map((post) => [post.id, post]));
        const comentariosPorId = new Map(comentarios.map((comentario) => [comentario.id, comentario]));
        const resultado = await Promise.all(pagina.map(async (notificacao) => {
            const post = postsPorId.get(notificacao.postId ?? 0) ?? null;
            let textoComentario = null;
            if (notificacao.postId && notificacao.atorId &&
                (notificacao.tipo === "comentario" || notificacao.tipo === "mencao")) {
                const instante = notificacao.criadaEm.getTime();
                const comentario = comentariosPorId.get(notificacao.comentarioId ?? 0) ??
                    await prismaClient_1.default.comentario.findFirst({
                        where: {
                            postId: notificacao.postId,
                            usuarioId: notificacao.atorId,
                            dataCriacao: { gte: new Date(instante - 5000), lte: new Date(instante + 5000) },
                        },
                        orderBy: { dataCriacao: "desc" },
                        select: { texto: true },
                    });
                textoComentario = comentario?.texto ?? null;
            }
            return {
                id: notificacao.id,
                tipo: notificacao.tipo,
                mensagem: notificacao.mensagem,
                lida: notificacao.lida,
                criadaEm: notificacao.criadaEm,
                usuario: notificacao.ator,
                usuarioId: notificacao.atorId,
                postId: notificacao.postId,
                musicaId: notificacao.musicaId,
                textoComentario,
                post,
                musica: post?.musica ?? null,
            };
        }));
        return res.json(paginar ? {
            itens: resultado,
            proximoCursor: notificacoes.length > tamanhoPagina ? pagina[pagina.length - 1].id : null,
            quantidadeNaoLidas,
        } : resultado);
    }
    catch (error) {
        console.error("Erro ao buscar notificações:", error);
        return res.status(500).json({
            erro: "Não foi possível carregar as notificações.",
        });
    }
});
// Marca uma notificação específica como lida.
router.delete("/notificacoes", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const resultado = await prismaClient_1.default.notificacao.deleteMany({
            where: { usuarioId: req.usuarioId },
        });
        return res.json({
            mensagem: "Notificações removidas.",
            quantidade: resultado.count,
        });
    }
    catch (error) {
        console.error("Erro ao limpar notificações:", error);
        return res.status(500).json({
            erro: "Não foi possível limpar as notificações.",
        });
    }
});
router.patch("/notificacoes/:id/lida", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                erro: "ID da notificação inválido.",
            });
        }
        const resultado = await prismaClient_1.default.notificacao.updateMany({
            where: {
                id,
                usuarioId,
            },
            data: {
                lida: true,
            },
        });
        if (resultado.count === 0) {
            return res.status(404).json({
                erro: "Notificação não encontrada.",
            });
        }
        return res.json({
            mensagem: "Notificação marcada como lida.",
        });
    }
    catch (error) {
        console.error("Erro ao atualizar notificação:", error);
        return res.status(500).json({
            erro: "Não foi possível atualizar a notificação.",
        });
    }
});
// Marca todas as notificações do usuário como lidas.
router.patch("/notificacoes/lidas", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        await prismaClient_1.default.notificacao.updateMany({
            where: {
                usuarioId,
                lida: false,
            },
            data: {
                lida: true,
            },
        });
        return res.json({
            mensagem: "Todas as notificações foram marcadas como lidas.",
        });
    }
    catch (error) {
        console.error("Erro ao marcar todas as notificações como lidas:", error);
        return res.status(500).json({
            erro: "Não foi possível atualizar as notificações.",
        });
    }
});
exports.default = router;
