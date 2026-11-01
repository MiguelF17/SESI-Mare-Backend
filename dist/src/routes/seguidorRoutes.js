"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Seguir usuário
router.post("/usuarios/:id/seguir", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const seguidoId = Number(req.params.id);
        const seguidorId = req.usuarioId;
        if (seguidorId === seguidoId) {
            return res.status(400).json({
                error: "Você não pode seguir a si mesmo"
            });
        }
        const usuario = await prismaClient_1.default.usuario.findUnique({
            where: {
                id: seguidoId
            }
        });
        if (!usuario) {
            return res.status(404).json({
                error: "Usuário não encontrado"
            });
        }
        const seguindo = await prismaClient_1.default.seguidor.findUnique({
            where: {
                seguidorId_seguidoId: {
                    seguidorId,
                    seguidoId
                }
            }
        });
        if (seguindo) {
            return res.status(409).json({
                error: "Você já segue este usuário"
            });
        }
        const seguidor = await prismaClient_1.default.seguidor.create({
            data: {
                seguidorId,
                seguidoId
            }
        });
        // Notifica o usuário que recebeu um novo seguidor
        if (usuario.notificacoesSeguidores) {
            await prismaClient_1.default.notificacao.create({
                data: {
                    tipo: "seguir",
                    mensagem: "começou a seguir você",
                    usuarioId: seguidoId,
                    atorId: seguidorId
                }
            });
        }
        return res.status(201).json({
            message: "Usuário seguido com sucesso",
            seguidor
        });
    }
    catch (error) {
        console.error("Erro ao seguir usuário", error);
        return res.status(500).json({
            error: "Erro interno"
        });
    }
});
// Deixar de seguir
router.delete("/usuarios/:id/seguir", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const seguidoId = Number(req.params.id);
        const seguidorId = req.usuarioId;
        const seguindo = await prismaClient_1.default.seguidor.findUnique({
            where: {
                seguidorId_seguidoId: {
                    seguidorId,
                    seguidoId
                }
            }
        });
        if (!seguindo) {
            return res.status(404).json({
                error: "Você não segue este usuário"
            });
        }
        await prismaClient_1.default.seguidor.delete({
            where: {
                seguidorId_seguidoId: {
                    seguidorId,
                    seguidoId
                }
            }
        });
        return res.status(200).json({
            message: "Você deixou de seguir este usuário"
        });
    }
    catch (error) {
        console.error("Erro ao deixar de seguir", error);
        return res.status(500).json({
            error: "Erro interno"
        });
    }
});
// Listar seguidores
router.get("/usuarios/:id/seguidores", async (req, res) => {
    try {
        const usuarioId = Number(req.params.id);
        const seguidores = await prismaClient_1.default.seguidor.findMany({
            where: {
                seguidoId: usuarioId
            },
            include: {
                seguidor: {
                    select: {
                        id: true,
                        nome: true,
                        username: true,
                        foto: true,
                    },
                },
            },
        });
        return res.status(200).json(seguidores);
    }
    catch (error) {
        console.error("Erro ao listar seguidores", error);
        return res.status(500).json({
            error: "Erro interno"
        });
    }
});
// Listar quem o usuário segue
router.get("/usuarios/:id/seguindo", async (req, res) => {
    try {
        const usuarioId = Number(req.params.id);
        const seguindo = await prismaClient_1.default.seguidor.findMany({
            where: {
                seguidorId: usuarioId
            },
            include: {
                seguido: {
                    select: {
                        id: true,
                        nome: true,
                        username: true,
                        foto: true,
                    },
                },
            },
        });
        return res.status(200).json(seguindo);
    }
    catch (error) {
        console.error("Erro ao listar seguindo", error);
        return res.status(500).json({
            error: "Erro interno"
        });
    }
});
exports.default = router;
