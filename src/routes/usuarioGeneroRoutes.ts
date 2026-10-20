import { Router, Response } from "express"
import prisma from "../prismaClient"
import { AuthRequest, authMiddleware } from "../middleware/authMiddleware"

const router = Router()

router.put(
    "/usuarios/me/generos",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const usuarioId = req.usuarioId!;
            const { generos } = req.body;

            if (
                !Array.isArray(generos) ||
                generos.some(
                    (genero) =>
                        typeof genero !== "string" || !genero.trim()
                )
            ) {
                return res.status(400).json({
                    error: "Envie uma lista válida de gêneros musicais.",
                });
            }

            const generosUnicos = [
                ...new Set(
                    generos.map((genero: string) => genero.trim())
                ),
            ];

            if (generosUnicos.length === 0) {
                return res.status(400).json({
                    error: "Selecione pelo menos um gênero musical.",
                });
            }

            await prisma.$transaction([
                prisma.usuarioGenero.deleteMany({
                    where: { usuarioId },
                }),

                prisma.usuarioGenero.createMany({
                    data: generosUnicos.map((genero: string) => ({
                        usuarioId,
                        genero,
                    })),
                }),

                prisma.usuario.update({
                    where: { id: usuarioId },
                    data: {
                        preferenciasConcluidas: true,
                    },
                }),
            ]);

            return res.status(200).json({
                message: "Gêneros musicais salvos com sucesso.",
                generos: generosUnicos,
            });
        } catch (error) {
            console.error("Erro ao salvar gêneros:", error);

            return res.status(500).json({
                error: "Não foi possível salvar os gêneros musicais.",
            });
        }
    }
);

router.get(
    "/usuarios/me/generos",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const usuarioId = req.usuarioId!;

            const generos = await prisma.usuarioGenero.findMany({
                where: { usuarioId },
                select: { genero: true },
            });

            return res.status(200).json(
                generos.map((item) => item.genero)
            );
        } catch (error) {
            console.error("Erro ao buscar gêneros favoritos:", error);

            return res.status(500).json({
                error: "Não foi possível buscar os gêneros favoritos.",
            });
        }
    }
);


export default router