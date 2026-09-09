import { Router, Response } from "express"
import prisma from "../prismaClient"
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware"

const router = Router()

// Curtir um post
router.post(
    "/posts/:id/curtir",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const postId = Number(req.params.id)
            const usuarioId = req.usuarioId!

            const post = await prisma.post.findUnique({
                where: {
                    id: postId
                }
            })

            if (!post) {
                return res.status(404).json({
                    error: "Post não encontrado"
                })
            }

            const curtidaExistente = await prisma.curtida.findUnique({
                where: {
                    usuarioId_postId: {
                        usuarioId,
                        postId
                    }
                }
            })

            if (curtidaExistente) {
                return res.status(409).json({
                    error: "Você já curtiu este post"
                })
            }

            const curtida = await prisma.curtida.create({
                data: {
                    usuarioId,
                    postId
                }
            })

            return res.status(201).json({
                message: "Post curtido com sucesso",
                curtida
            })

        } catch (error) {
            console.error("Erro ao curtir post", error)

            return res.status(500).json({
                error: "Erro interno"
            })
        }
    }
)

// Descurtir um post
router.delete(
    "/posts/:id/curtir",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const postId = Number(req.params.id)
            const usuarioId = req.usuarioId!

            const curtida = await prisma.curtida.findUnique({
                where: {
                    usuarioId_postId: {
                        usuarioId,
                        postId
                    }
                }
            })

            if (!curtida) {
                return res.status(404).json({
                    error: "Você ainda não curtiu este post"
                })
            }

            await prisma.curtida.delete({
                where: {
                    usuarioId_postId: {
                        usuarioId,
                        postId
                    }
                }
            })

            return res.status(200).json({
                message: "Curtida removida com sucesso"
            })

        } catch (error) {
            console.error("Erro ao remover curtida", error)

            return res.status(500).json({
                error: "Erro interno"
            })
        }
    }
)

export default router