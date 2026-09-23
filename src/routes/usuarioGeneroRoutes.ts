import { Router, Response } from "express"
import prisma from "../prismaClient"
import { AuthRequest, authMiddleware } from "../middleware/authMiddleware"

const router = Router()

// Salvar os gêneros favoritos do usuário
router.post(
    "/usuarios/me/generos",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const usuarioId = req.usuarioId!

            const { generos } = req.body

            // Verifica se foi enviada uma lista de gêneros
            if (!Array.isArray(generos) || generos.length === 0) {
                return res.status(400).json({
                    error: "Escolha pelo menos um gênero"
                })
            }

            // Remove gêneros repetidos
            const generosUnicos = [...new Set(generos)]

            // Salva cada gênero para o usuário
            const favoritos = await prisma.usuarioGenero.createMany({
                data: generosUnicos.map((genero: string) => ({
                    usuarioId,
                    genero
                }))
            })

            return res.status(201).json({
                message: "Gêneros favoritos salvos com sucesso",
                quantidade: favoritos.count
            })

        } catch (error) {
            console.error("Erro ao salvar gêneros favoritos", error)

            return res.status(500).json({
                error: "Erro interno"
            })
        }
    }
)

export default router