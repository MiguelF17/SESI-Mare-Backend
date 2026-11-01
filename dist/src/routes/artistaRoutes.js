"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const router = (0, express_1.Router)();
// Cadastrar artista
router.post("/artistas", async (req, res) => {
    try {
        const { nome, fotoURL } = req.body;
        if (!nome) {
            return res.status(400).json({
                error: "Informe o nome do artista",
            });
        }
        const artista = await prismaClient_1.default.artista.create({
            data: {
                nome,
                fotoURL,
            },
        });
        return res.status(201).json(artista);
    }
    catch (error) {
        console.error("Erro ao cadastrar artista", error);
        return res.status(500).json({
            error: "Erro interno",
        });
    }
});
// Listar artistas
router.get("/artistas", async (req, res) => {
    try {
        const artistas = await prismaClient_1.default.artista.findMany({
            orderBy: {
                nome: "asc",
            },
        });
        return res.status(200).json(artistas);
    }
    catch (error) {
        console.error("Erro ao listar artistas", error);
        return res.status(500).json({
            error: "Erro interno",
        });
    }
});
// Buscar um artista pelo ID
router.get("/artistas/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const artista = await prismaClient_1.default.artista.findUnique({
            where: {
                id,
            },
            include: {
                musicas: true,
            },
        });
        if (!artista) {
            return res.status(404).json({
                error: "Artista não encontrado",
            });
        }
        return res.status(200).json(artista);
    }
    catch (error) {
        console.error("Erro ao buscar artista", error);
        return res.status(500).json({
            error: "Erro interno",
        });
    }
});
// Editar artista
router.put("/artistas/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { nome, fotoURL } = req.body;
        const artistaExistente = await prismaClient_1.default.artista.findUnique({
            where: {
                id,
            },
        });
        if (!artistaExistente) {
            return res.status(404).json({
                error: "Artista não encontrado",
            });
        }
        const artista = await prismaClient_1.default.artista.update({
            where: {
                id,
            },
            data: {
                nome,
                fotoURL,
            },
        });
        return res.status(200).json(artista);
    }
    catch (error) {
        console.error("Erro ao editar artista", error);
        return res.status(500).json({
            error: "Erro interno",
        });
    }
});
// Deletar artista
router.delete("/artistas/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const artistaExistente = await prismaClient_1.default.artista.findUnique({
            where: {
                id,
            },
        });
        if (!artistaExistente) {
            return res.status(404).json({
                error: "Artista não encontrado",
            });
        }
        await prismaClient_1.default.artista.delete({
            where: {
                id,
            },
        });
        return res.status(200).json({
            message: "Artista deletado com sucesso",
        });
    }
    catch (error) {
        console.error("Erro ao deletar artista", error);
        return res.status(500).json({
            error: "Erro interno",
        });
    }
});
exports.default = router;
