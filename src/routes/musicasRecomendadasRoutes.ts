import { Router, Response } from "express";
import prisma from "../prismaClient";
import { AuthRequest, authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.get(
  "/musicas/recomendadas",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId!;

      const [generos, artistas] = await Promise.all([
        prisma.usuarioGenero.findMany({
          where: { usuarioId },
          select: { genero: true },
        }),

        prisma.usuarioArtista.findMany({
          where: { usuarioId },
          select: { artistaId: true },
        }),
      ]);

      const generosFavoritos = generos.map(
        (item) => item.genero
      );

      const artistasFavoritos = artistas.map(
        (item) => item.artistaId
      );

      // Sem preferências cadastradas, não há recomendações personalizadas.
      if (
        generosFavoritos.length === 0 &&
        artistasFavoritos.length === 0
      ) {
        return res.status(200).json([]);
      }

      const filtros = [];

      if (generosFavoritos.length > 0) {
        filtros.push({
          genero: { in: generosFavoritos },
        });
      }

      if (artistasFavoritos.length > 0) {
        filtros.push({
          artistaId: { in: artistasFavoritos },
        });
      }

      const musicas = await prisma.musica.findMany({
        where: {
          OR: filtros,
        },
        include: {
          artista: true,
        },
        take: 20,
      });

      return res.status(200).json(musicas);
    } catch (error) {
      console.error("Erro ao buscar recomendações:", error);

      return res.status(500).json({
        error: "Não foi possível buscar músicas recomendadas.",
      });
    }
  }
);

export default router;