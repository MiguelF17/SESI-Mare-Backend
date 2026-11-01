"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Salvar música
router.post("/musicas/:id/salvar", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const musicaId = Number(req.params.id);
        const usuarioId = req.usuarioId;
        const musica = await prismaClient_1.default.musica.findUnique({
            where: {
                id: musicaId,
            },
        });
        if (!musica) {
            return res.status(404).json({
                error: "Música não encontrada",
            });
        }
        const salvamentoExistente = await prismaClient_1.default.salvamento.findUnique({
            where: {
                usuarioId_musicaId: {
                    usuarioId,
                    musicaId,
                },
            },
        });
        if (salvamentoExistente) {
            return res.status(409).json({
                error: "Esta música já está salva",
            });
        }
        const salvamento = await prismaClient_1.default.salvamento.create({
            data: {
                usuarioId,
                musicaId,
            },
        });
        return res.status(201).json({
            message: "Música salva com sucesso",
            salvamento,
        });
    }
    catch (error) {
        console.error("Erro ao salvar música", error);
        return res.status(500).json({
            error: "Erro interno",
        });
    }
});
// Remover música dos salvos
router.delete("/musicas/:id/salvar", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const musicaId = Number(req.params.id);
        const usuarioId = req.usuarioId;
        const salvamento = await prismaClient_1.default.salvamento.findUnique({
            where: {
                usuarioId_musicaId: {
                    usuarioId,
                    musicaId,
                },
            },
        });
        if (!salvamento) {
            return res.status(404).json({
                error: "Esta música não está salva",
            });
        }
        await prismaClient_1.default.salvamento.delete({
            where: {
                usuarioId_musicaId: {
                    usuarioId,
                    musicaId,
                },
            },
        });
        return res.status(200).json({
            message: "Música removida dos salvos",
        });
    }
    catch (error) {
        console.error("Erro ao remover música salva", error);
        return res.status(500).json({
            error: "Erro interno",
        });
    }
});
// Listar músicas salvas pelo usuário
router.get("/usuarios/me/salvos", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const salvos = await prismaClient_1.default.salvamento.findMany({
            where: { usuarioId },
            orderBy: { dataCriacao: "desc" },
            include: {
                musica: {
                    include: {
                        artista: true,
                        posts: {
                            select: { nota: true },
                        },
                    },
                },
            },
        });
        const resultado = salvos.map((salvamento) => {
            const musica = salvamento.musica;
            const posts = musica.posts;
            const notas = posts
                .map((post) => post.nota)
                .filter((nota) => nota !== null);
            const notaMedia = notas.length > 0
                ? notas.reduce((soma, nota) => soma + nota, 0) / notas.length
                : 0;
            const { posts: _posts, ...dadosMusica } = musica;
            return {
                ...salvamento,
                musica: {
                    ...dadosMusica,
                    nota: notaMedia,
                    _count: {
                        posts: posts.length,
                    },
                },
            };
        });
        return res.status(200).json(resultado);
    }
    catch (error) {
        console.error("Erro ao buscar músicas salvas:", error);
        return res.status(500).json({ error: "Erro interno" });
    }
});
exports.default = router;
