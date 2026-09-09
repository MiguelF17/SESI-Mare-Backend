import { Router, Response } from "express"
import prisma from "../prismaClient"
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware"

const router = Router()

// Criar comentário
router.post(
    "/posts/:postId/comentarios",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const postId = Number(req.params.postId)
            const usuarioId = req.usuarioId!
            const { texto } = req.body

            if (!texto) {
                return res.status(400).json({
                    error: "Informe o texto do comentário"
                })
            }

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

            const comentario = await prisma.comentario.create({
                data: {
                    usuarioId,
                    postId,
                    texto
                },
                include: {
                    usuario: {
                        select: {
                            id: true,
                            nome: true,
                            foto: true
                        }
                    }
                }
            })

            return res.status(201).json(comentario)

        } catch (error) {
            console.error("Erro ao criar comentário", error)

            return res.status(500).json({
                error: "Erro interno"
            })
        }
    }
)

// Listar comentários de um post
router.get(
    "/posts/:postId/comentarios",
    async (req, res: Response) => {
        try {
            const postId = Number(req.params.postId)

            const comentarios = await prisma.comentario.findMany({
                where: {
                    postId
                },
                orderBy: {
                    dataCriacao: "asc"
                },
                include: {
                    usuario: {
                        select: {
                            id: true,
                            nome: true,
                            foto: true
                        }
                    }
                }
            })

            return res.status(200).json(comentarios)

        } catch (error) {
            console.error("Erro ao listar comentários", error)

            return res.status(500).json({
                error: "Erro interno"
            })
        }
    }
)

// Excluir comentário
router.delete(
    "/comentarios/:id",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const comentarioId = Number(req.params.id)
            const usuarioId = req.usuarioId!

            const comentario = await prisma.comentario.findUnique({
                where: {
                    id: comentarioId
                }
            })

            if (!comentario) {
                return res.status(404).json({
                    error: "Comentário não encontrado"
                })
            }

            if (comentario.usuarioId !== usuarioId) {
                return res.status(403).json({
                    error: "Você não pode excluir este comentário"
                })
            }

            await prisma.comentario.delete({
                where: {
                    id: comentarioId
                }
            })

            return res.status(200).json({
                message: "Comentário excluído com sucesso"
            })

        } catch (error) {
            console.error("Erro ao excluir comentário", error)

            return res.status(500).json({
                error: "Erro interno"
            })
        }
    }
)

export default router