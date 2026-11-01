"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Lista as notificações do usuário logado.
router.get("/notificacoes", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const notificacoes = await prismaClient_1.default.notificacao.findMany({
            where: { usuarioId },
            include: {
                ator: {
                    select: {
                        id: true,
                        nome: true,
                        username: true,
                        foto: true,
                    },
                },
            },
            orderBy: {
                criadaEm: "desc",
            },
        });
        const resultado = await Promise.all(notificacoes.map(async (notificacao) => {
            let postDetalhes = null;
            let textoComentario = null;
            if (notificacao.postId) {
                postDetalhes = await prismaClient_1.default.post.findUnique({
                    where: {
                        id: notificacao.postId,
                    },
                    select: {
                        id: true,
                        texto: true,
                        nota: true,
                        editado: true,
                        musica: {
                            select: {
                                id: true,
                                titulo: true,
                                capa: true,
                                artista: {
                                    select: {
                                        nome: true,
                                    },
                                },
                            },
                        },
                    },
                });
                if ((notificacao.tipo === "comentario" || notificacao.tipo === "mencao") &&
                    notificacao.atorId) {
                    const comentario = notificacao.comentarioId
                        ? await prismaClient_1.default.comentario.findUnique({
                            where: { id: notificacao.comentarioId },
                            select: { texto: true },
                        })
                        : null;
                    const inicio = new Date(notificacao.criadaEm.getTime() - 5000);
                    const fim = new Date(notificacao.criadaEm.getTime() + 5000);
                    const comentarioLegado = comentario ??
                        await prismaClient_1.default.comentario.findFirst({
                            where: {
                                postId: notificacao.postId,
                                usuarioId: notificacao.atorId,
                                dataCriacao: {
                                    gte: inicio,
                                    lte: fim,
                                },
                            },
                            orderBy: {
                                dataCriacao: "desc",
                            },
                            select: {
                                texto: true,
                            },
                        });
                    textoComentario = comentarioLegado?.texto ?? null;
                }
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
                post: postDetalhes,
                musica: postDetalhes?.musica ?? null,
            };
        }));
        return res.json(resultado);
    }
    catch (error) {
        console.error("Erro ao buscar notificações:", error);
        return res.status(500).json({
            erro: "Não foi possível carregar as notificações.",
        });
    }
});
// Marca uma notificação específica como lida.
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
