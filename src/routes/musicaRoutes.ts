import { Router, Request, Response } from "express";
import prisma from "../prismaClient";

const router =Router()

// Cadastrar o pet
router.post("/musicas", async (req: Request, res: Response) => {
    try {
        const {titulo, artista, genero, duracaoSegundos} = req.body

        if(!titulo || !artista || !genero || !duracaoSegundos){
            return res.status(400).json({error:"Informe todos os campos"})
        }

        const musicaSalva = await prisma.musica.create({
            data: {titulo,
                artista,
                genero,
                duracaoSegundos}
        })

        return res.status(201).json(musicaSalva)

    }catch (error){
        console.error("Erro ao cadastrar a musica", error)
        res.status(500).json({error: 'Erro interno'})
    }
})

router.get("/musicas", async (req: Request, res: Response) => {
    try{
        const musicas = await prisma.musica.findMany()

        return res.status(200).json(musicas)

    }catch(error){
        console.error("Erro ao listar musicas")
        res.status(500).json({error: 'Erro interno'})
    }
})

export default router