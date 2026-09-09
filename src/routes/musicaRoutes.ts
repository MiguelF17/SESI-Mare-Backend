import { Router, Request, Response } from "express";
import prisma from "../prismaClient";

const router = Router()

// Cadastrar a musica
router.post("/musicas", async (req: Request, res: Response) => {
    try {
        const { titulo, artista, genero, duracaoSegundos, capa, spotifyUrl, spotifyId } = req.body

        if (!titulo || !artista || !genero || !duracaoSegundos || !capa || !spotifyUrl) {
            return res.status(400).json({ error: "Informe todos os campos" })
        }

        const musicaSalva = await prisma.musica.create({
            data: {
                titulo,
                artista,
                genero,
                duracaoSegundos,
                capa,
                spotifyUrl,
                spotifyId
            }
        })

        return res.status(201).json(musicaSalva)

    } catch (error) {
        console.error("Erro ao cadastrar a musica", error)
        res.status(500).json({ error: 'Erro interno' })
    }
})


// Buscar a musica
router.get("/musicas", async (req: Request, res: Response) => {

    // Função na qual busca a música com base no artista ou titulo
    try {
        const search = req.query.search as string | undefined

        const musicas = await prisma.musica.findMany({
            where: search
                ? {
                    OR: [
                        {
                            titulo: {
                                contains: search
                            }
                        },
                        {
                            artista: {
                                contains: search
                            }
                        }
                    ]
                }
                : undefined
        })

        return res.status(200).json(musicas)

    } catch (error) {
        console.error("Erro ao listar musicas", error)

        return res.status(500).json({
            error: "Erro interno"
        })
    }
})

router.get("/musicas/:id", async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)

        const musica = await prisma.musica.findUnique({
            where: {
                id: id
            }
        })

        if (!musica) {
            return res.status(404).json({
                error: "Música não encontrada"
            })
        }

        return res.status(200).json(musica)

    } catch (error) {
        console.error("Erro ao buscar música", error)
        return res.status(500).json({
            error: "Erro interno"
        })
    }
})

export default router