import { Router, Response } from "express"
import prisma from "../prismaClient"
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware"

const router = Router()

// Seguir usuário
router.post(
    "/usuarios/:id/seguir",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const seguidoId = Number(req.params.id)
            const seguidorId = req.usuarioId!

            if (seguidorId === seguidoId) {
                return res.status(400).json({
                    error: "Você não pode seguir a si mesmo"
                })
            }

            const usuario = await prisma.usuario.findUnique({
                where: {
                    id: seguidoId
                }
            })

            if (!usuario) {
                return res.status(404).json({
                    error: "Usuário não encontrado"
                })
            }

            const seguindo = await prisma.seguidor.findUnique({
                where: {
                    seguidorId_seguidoId: {
                        seguidorId,
                        seguidoId
                    }
                }
            })

            if (seguindo) {
                return res.status(409).json({
                    error: "Você já segue este usuário"
                })
            }

            const seguidor = await prisma.seguidor.create({
                data: {
                    seguidorId,
                    seguidoId
                }
            })

            return res.status(201).json({
                message: "Usuário seguido com sucesso",
                seguidor
            })

        } catch (error) {
            console.error("Erro ao seguir usuário", error)

            return res.status(500).json({
                error: "Erro interno"
            })
        }
    }
)

// Deixar de seguir
router.delete(
    "/usuarios/:id/seguir",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const seguidoId = Number(req.params.id)
            const seguidorId = req.usuarioId!

            const seguindo = await prisma.seguidor.findUnique({
                where: {
                    seguidorId_seguidoId: {
                        seguidorId,
                        seguidoId
                    }
                }
            })

            if (!seguindo) {
                return res.status(404).json({
                    error: "Você não segue este usuário"
                })
            }

            await prisma.seguidor.delete({
                where: {
                    seguidorId_seguidoId: {
                        seguidorId,
                        seguidoId
                    }
                }
            })

            return res.status(200).json({
                message: "Você deixou de seguir este usuário"
            })

        } catch (error) {
            console.error("Erro ao deixar de seguir", error)

            return res.status(500).json({
                error: "Erro interno"
            })
        }
    }
)

// Listar seguidores
router.get(
    "/usuarios/:id/seguidores",
    async (req, res: Response) => {
        try {
            const usuarioId = Number(req.params.id)

            const seguidores = await prisma.seguidor.findMany({
                where: {
                    seguidoId: usuarioId
                },
                include: {
                    seguidor: {
                        select: {
                            id: true,
                            nome: true,
                            foto: true
                        }
                    }
                }
            })

            return res.status(200).json(seguidores)

        } catch (error) {
            console.error("Erro ao listar seguidores", error)

            return res.status(500).json({
                error: "Erro interno"
            })
        }
    }
)

// Listar quem o usuário segue
router.get(
    "/usuarios/:id/seguindo",
    async (req, res: Response) => {
        try {
            const usuarioId = Number(req.params.id)

            const seguindo = await prisma.seguidor.findMany({
                where: {
                    seguidorId: usuarioId
                },
                include: {
                    seguido: {
                        select: {
                            id: true,
                            nome: true,
                            foto: true
                        }
                    }
                }
            })

            return res.status(200).json(seguindo)

        } catch (error) {
            console.error("Erro ao listar seguindo", error)

            return res.status(500).json({
                error: "Erro interno"
            })
        }
    }
)

export default router