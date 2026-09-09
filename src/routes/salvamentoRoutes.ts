import { Router, Response } from "express"
import prisma from "../prismaClient"
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware"

const router = Router()

// Salvar música
router.post(
    "/musicas/:id/salvar",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const musicaId = Number(req.params.id)
            const usuarioId = req.usuarioId!

            const musica = await prisma.musica.findUnique({
                where: {
                    id: musicaId
                }
            })

            if (!musica) {
                return res.status(404).json({
                    error: "Música não encontrada"
                })
            }

            const salvamentoExistente = await prisma.salvamento.findUnique({
                where: {
                    usuarioId_musicaId: {
                        usuarioId,
                        musicaId
                    }
                }
            })

            if (salvamentoExistente) {
                return res.status(409).json({
                    error: "Esta música já está salva"
                })
            }

            const salvamento = await prisma.salvamento.create({
                data: {
                    usuarioId,
                    musicaId
                }
            })

            return res.status(201).json({
                message: "Música salva com sucesso",
                salvamento
            })

        } catch (error) {
            console.error("Erro ao salvar música", error)

            return res.status(500).json({
                error: "Erro interno"
            })
        }
    }
)

// Remover música dos salvos
router.delete(
    "/musicas/:id/salvar",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const musicaId = Number(req.params.id)
            const usuarioId = req.usuarioId!

            const salvamento = await prisma.salvamento.findUnique({
                where: {
                    usuarioId_musicaId: {
                        usuarioId,
                        musicaId
                    }
                }
            })

            if (!salvamento) {
                return res.status(404).json({
                    error: "Esta música não está salva"
                })
            }

            await prisma.salvamento.delete({
                where: {
                    usuarioId_musicaId: {
                        usuarioId,
                        musicaId
                    }
                }
            })

            return res.status(200).json({
                message: "Música removida dos salvos"
            })

        } catch (error) {
            console.error("Erro ao remover música salva", error)

            return res.status(500).json({
                error: "Erro interno"
            })
        }
    }
)

// Listar músicas salvas pelo usuário
router.get(
    "/usuarios/me/salvos",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const usuarioId = req.usuarioId!

            const salvos = await prisma.salvamento.findMany({
                where: {
                    usuarioId
                },
                orderBy: {
                    dataCriacao: "desc"
                },
                include: {
                    musica: true
                }
            })

            return res.status(200).json(salvos)

        } catch (error) {
            console.error("Erro ao listar músicas salvas", error)

            return res.status(500).json({
                error: "Erro interno"
            })
        }
    }
)

export default router