"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
const router = (0, express_1.Router)();
// Adicionar um artista aos favoritos do usuário
router.post("/usuarios/me/artistas", authMiddleware_1.default, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const { artistaIds } = req.body;
        if (!Array.isArray(artistaIds) ||
            artistaIds.length === 0 ||
            artistaIds.some((id) => !Number.isInteger(Number(id)) || Number(id) <= 0)) {
            return res.status(400).json({
                error: "Envie uma lista válida de artistas.",
            });
        }
        const ids = [...new Set(artistaIds.map(Number))];
        const artistasExistentes = await prismaClient_1.default.artista.findMany({
            where: {
                id: { in: ids },
            },
            select: {
                id: true,
            },
        });
        if (artistasExistentes.length !== ids.length) {
            return res.status(400).json({
                error: "Um ou mais artistas não foram encontrados.",
            });
        }
        const favoritosExistentes = await prismaClient_1.default.usuarioArtista.findMany({
            where: {
                usuarioId,
                artistaId: { in: ids },
            },
            select: {
                artistaId: true,
            },
        });
        const idsExistentes = new Set(favoritosExistentes.map((item) => item.artistaId));
        const novosFavoritos = ids
            .filter((id) => !idsExistentes.has(id))
            .map((artistaId) => ({
            usuarioId,
            artistaId,
        }));
        if (novosFavoritos.length > 0) {
            await prismaClient_1.default.usuarioArtista.createMany({
                data: novosFavoritos,
            });
        }
        return res.status(201).json({
            message: "Artistas favoritos salvos com sucesso.",
        });
    }
    catch (error) {
        console.error("Erro ao salvar artistas favoritos:", error);
        return res.status(500).json({
            error: "Não foi possível salvar os artistas favoritos.",
        });
    }
});
// Listar os artistas favoritos do usuário
router.get("/usuarios/me/artistas", authMiddleware_1.default, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const artistas = await prismaClient_1.default.usuarioArtista.findMany({
            where: {
                usuarioId,
            },
            include: {
                artista: true,
            },
        });
        return res.status(200).json(artistas);
    }
    catch (error) {
        console.error("Erro ao buscar artistas favoritos", error);
        return res.status(500).json({
            error: "Erro interno",
        });
    }
});
exports.default = router;
