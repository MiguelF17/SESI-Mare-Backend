import { Router, Request, Response } from "express"
import prisma from "../prismaClient"

const router = Router()

// Cadastrar artista
router.post("/artistas", async (req: Request, res: Response) => {
    try {
        const { nome, foto } = req.body

        if (!nome) {
            return res.status(400).json({
                error: "Informe o nome do artista"
            })
        }

        const artista = await prisma.artista.create({
            data: {
                nome,
                foto
            }
        })

        return res.status(201).json(artista)

    } catch (error) {
        console.error("Erro ao cadastrar artista", error)

        return res.status(500).json({
            error: "Erro interno"
        })
    }
})


// Listar artistas
router.get("/artistas", async (req: Request, res: Response) => {
    try {
        const artistas = await prisma.artista.findMany({
            orderBy: {
                nome: "asc"
            }
        })

        return res.status(200).json(artistas)

    } catch (error) {
        console.error("Erro ao listar artistas", error)

        return res.status(500).json({
            error: "Erro interno"
        })
    }
})

// Buscar um artista pelo ID
router.get("/artistas/:id", async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)

        const artista = await prisma.artista.findUnique({
            where: {
                id
            },
            include: {
                musicas: true
            }
        })

        if (!artista) {
            return res.status(404).json({
                error: "Artista não encontrado"
            })
        }

        return res.status(200).json(artista)

    } catch (error) {
        console.error("Erro ao buscar artista", error)

        return res.status(500).json({
            error: "Erro interno"
        })
    }
})

export default router