"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.put("/usuarios/me/generos", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const { generos } = req.body;
        if (!Array.isArray(generos) ||
            generos.some((genero) => typeof genero !== "string" || !genero.trim())) {
            return res.status(400).json({
                error: "Envie uma lista válida de gêneros musicais.",
            });
        }
        const generosUnicos = [
            ...new Set(generos.map((genero) => genero.trim())),
        ];
        if (generosUnicos.length === 0) {
            return res.status(400).json({
                error: "Selecione pelo menos um gênero musical.",
            });
        }
        await prismaClient_1.default.$transaction([
            prismaClient_1.default.usuarioGenero.deleteMany({
                where: { usuarioId },
            }),
            prismaClient_1.default.usuarioGenero.createMany({
                data: generosUnicos.map((genero) => ({
                    usuarioId,
                    genero,
                })),
            }),
            prismaClient_1.default.usuario.update({
                where: { id: usuarioId },
                data: {
                    preferenciasConcluidas: true,
                },
            }),
        ]);
        return res.status(200).json({
            message: "Gêneros musicais salvos com sucesso.",
            generos: generosUnicos,
        });
    }
    catch (error) {
        console.error("Erro ao salvar gêneros:", error);
        return res.status(500).json({
            error: "Não foi possível salvar os gêneros musicais.",
        });
    }
});
router.get("/usuarios/me/generos", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const generos = await prismaClient_1.default.usuarioGenero.findMany({
            where: { usuarioId },
            select: { genero: true },
        });
        return res.status(200).json(generos.map((item) => item.genero));
    }
    catch (error) {
        console.error("Erro ao buscar gêneros favoritos:", error);
        return res.status(500).json({
            error: "Não foi possível buscar os gêneros favoritos.",
        });
    }
});
exports.default = router;
