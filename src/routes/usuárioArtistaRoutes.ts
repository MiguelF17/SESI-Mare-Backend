import { Router, Response } from "express";
import prisma from "../prismaClient";
import { AuthRequest } from "../middleware/authMiddleware";
import authMiddleware from "../middleware/authMiddleware";

const router = Router();

// Adicionar um artista aos favoritos do usuário
router.post(
  "/usuarios/me/artistas",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      // Pega o ID do usuário que está logado
      const usuarioId = req.usuarioId!;

      const { artistaId } = req.body;

      if (!artistaId) {
        return res.status(400).json({
          error: "Informe o artista",
        });
      }

      // Verifica se o artista existe
      const artista = await prisma.artista.findUnique({
        where: {
          id: Number(artistaId),
        },
      });

      if (!artista) {
        return res.status(404).json({
          error: "Artista não encontrado",
        });
      }

      // Salva a preferência
      const favorito = await prisma.usuarioArtista.create({
        data: {
          usuarioId,
          artistaId: Number(artistaId),
        },
      });

      return res.status(201).json(favorito);
    } catch (error) {
      console.error("Erro ao salvar artista favorito", error);

      return res.status(500).json({
        error: "Erro interno",
      });
    }
  },
);

// Listar os artistas favoritos do usuário
router.get(
  "/usuarios/me/artistas",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId!;

      const artistas = await prisma.usuarioArtista.findMany({
        where: {
          usuarioId,
        },
        include: {
          artista: true,
        },
      });

      return res.status(200).json(artistas);
    } catch (error) {
      console.error("Erro ao buscar artistas favoritos", error);

      return res.status(500).json({
        error: "Erro interno",
      });
    }
  },
);

export default router;
