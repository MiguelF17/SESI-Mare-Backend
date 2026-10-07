import { Router, Request, Response } from "express";
import prisma from "../prismaClient";

const router = Router();

// Cadastrar a musica
router.post("/musicas", async (req: Request, res: Response) => {
  try {
    const {
      titulo,
      artistaId,
      genero,
      duracaoSegundos,
      capa,
      spotifyUrl,
      spotifyId,
    } = req.body;

    if (!titulo || !artistaId || !genero || !duracaoSegundos) {
      return res.status(400).json({
        error: "Informe título, artista, gênero e duração",
      });
    }

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

    const musica = await prisma.musica.create({
      data: {
        titulo,
        artistaId: Number(artistaId),
        genero,
        duracaoSegundos: Number(duracaoSegundos),
        capa,
        spotifyUrl,
        spotifyId,
      },
      include: {
        artista: true,
      },
    });

    return res.status(201).json(musica);
  } catch (error) {
    console.error("Erro ao cadastrar música", error);

    return res.status(500).json({
      error: "Erro interno",
    });
  }
});

// Buscar músicas
router.get("/musicas", async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;

    const musicas = await prisma.musica.findMany({
      where: search
        ? {
            OR: [
              {
                titulo: {
                  contains: search,
                },
              },
              {
                artista: {
                  nome: {
                    contains: search,
                  },
                },
              },
            ],
          }
        : undefined,

      include: {
        artista: true,

        _count: {
          select: {
            posts: true,
          },
        },

        posts: {
          select: {
            nota: true,
          },
        },
      },
    });

    const musicasFormatadas = musicas.map((musica) => {
      const quantidadeAvaliacoes = musica.posts.length;

      const media =
        quantidadeAvaliacoes > 0
          ? musica.posts.reduce((total, post) => total + post.nota, 0) /
            quantidadeAvaliacoes
          : 0;

      return {
        id: musica.id,
        titulo: musica.titulo,
        genero: musica.genero,
        duracaoSegundos: musica.duracaoSegundos,
        capa: musica.capa,
        spotifyUrl: musica.spotifyUrl,
        spotifyId: musica.spotifyId,

        artista: musica.artista,

        nota: Number(media.toFixed(1)),
        avaliacoes: quantidadeAvaliacoes,
      };
    });

    return res.status(200).json(musicasFormatadas);
  } catch (error) {
    console.error("Erro ao listar músicas", error);

    return res.status(500).json({
      error: "Erro interno",
    });
  }
});

router.get("/musicas/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const musica = await prisma.musica.findUnique({
      where: {
        id,
      },

      include: {
        artista: true,

        posts: {
          select: {
            nota: true,
          },
        },
      },
    });

    if (!musica) {
      return res.status(404).json({
        error: "Música não encontrada",
      });
    }

    const quantidadeAvaliacoes = musica.posts.length;

    const media =
      quantidadeAvaliacoes > 0
        ? musica.posts.reduce((total, post) => total + post.nota, 0) /
          quantidadeAvaliacoes
        : 0;

    return res.status(200).json({
      id: musica.id,
      titulo: musica.titulo,
      genero: musica.genero,
      duracaoSegundos: musica.duracaoSegundos,
      capa: musica.capa,
      spotifyUrl: musica.spotifyUrl,
      spotifyId: musica.spotifyId,

      artista: musica.artista,

      nota: Number(media.toFixed(1)),
      avaliacoes: quantidadeAvaliacoes,
    });
  } catch (error) {
    console.error("Erro ao buscar música", error);

    return res.status(500).json({
      error: "Erro interno",
    });
  }
});

// Atualizar música
router.put("/musicas/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const {
      titulo,
      artistaId,
      genero,
      duracaoSegundos,
      capa,
      spotifyUrl,
      spotifyId,
    } = req.body;

    // Verifica se a música existe
    const musicaExistente = await prisma.musica.findUnique({
      where: {
        id,
      },
    });

    if (!musicaExistente) {
      return res.status(404).json({
        error: "Música não encontrada",
      });
    }

    // Se foi enviado um artista, verifica se ele existe
    if (artistaId) {
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
    }

    const musicaAtualizada = await prisma.musica.update({
      where: {
        id,
      },
      data: {
        titulo,
        artistaId: artistaId ? Number(artistaId) : undefined,
        genero,
        duracaoSegundos: duracaoSegundos
          ? Number(duracaoSegundos)
          : undefined,
        capa,
        spotifyUrl,
        spotifyId,
      },
      include: {
        artista: true,
      },
    });

    return res.status(200).json(musicaAtualizada);
  } catch (error) {
    console.error("Erro ao atualizar música", error);

    return res.status(500).json({
      error: "Erro interno",
    });
  }
});

// Excluir música
router.delete("/musicas/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    // Verifica se a música existe
    const musica = await prisma.musica.findUnique({
      where: {
        id,
      },
    });

    if (!musica) {
      return res.status(404).json({
        error: "Música não encontrada",
      });
    }

    await prisma.musica.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      message: "Música excluída com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir música", error);

    return res.status(500).json({
      error: "Erro interno",
    });
  }
});

export default router;
