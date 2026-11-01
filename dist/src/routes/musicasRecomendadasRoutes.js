"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.get("/musicas/recomendadas", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const [generos, artistas] = await Promise.all([
            prismaClient_1.default.usuarioGenero.findMany({
                where: { usuarioId },
                select: { genero: true },
            }),
            prismaClient_1.default.usuarioArtista.findMany({
                where: { usuarioId },
                select: { artistaId: true },
            }),
        ]);
        const generosFavoritos = generos.map((item) => item.genero);
        const artistasFavoritos = artistas.map((item) => item.artistaId);
        // Sem preferências cadastradas, não há recomendações personalizadas.
        if (generosFavoritos.length === 0 &&
            artistasFavoritos.length === 0) {
            return res.status(200).json([]);
        }
        const filtros = [];
        if (generosFavoritos.length > 0) {
            filtros.push({
                genero: { in: generosFavoritos },
            });
        }
        if (artistasFavoritos.length > 0) {
            filtros.push({
                artistaId: { in: artistasFavoritos },
            });
        }
        const musicas = await prismaClient_1.default.musica.findMany({
            where: {
                OR: filtros,
            },
            include: {
                artista: true,
            },
            take: 20,
        });
        return res.status(200).json(musicas);
    }
    catch (error) {
        console.error("Erro ao buscar recomendações:", error);
        return res.status(500).json({
            error: "Não foi possível buscar músicas recomendadas.",
        });
    }
});
exports.default = router;
