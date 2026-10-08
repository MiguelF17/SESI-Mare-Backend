import { Router, Request, Response } from "express";

import prisma from "../prismaClient";
import {
  optionalAuthMiddleware,
  authMiddleware,
  AuthRequest,
} from "../middleware/authMiddleware";

const router = Router();

// CRIAR UM POST
router.post(
  "/posts",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { musicaId, nota, texto } = req.body;

      if (!musicaId || nota === undefined || !texto) {
        return res.status(400).json({
          error: "Informe música, nota e texto",
        });
      }

      if (nota < 1 || nota > 5 || Number(nota) % 0.5 !== 0) {
        return res.status(400).json({
          error: "A nota deve estar entre 1 e 5, usando intervalos de 0,5",
        });
      }

      const musica = await prisma.musica.findUnique({
        where: {
          id: Number(musicaId),
        },
      });

      if (!musica) {
        return res.status(404).json({
          error: "Música não encontrada",
        });
      }

      const post = await prisma.post.create({
        data: {
          usuarioId: req.usuarioId!,
          musicaId: Number(musicaId),
          nota: Number(nota),
          texto,
        },
      });

      return res.status(201).json(post);
    } catch (error) {
      console.error("Erro ao criar post", error);

      return res.status(500).json({
        error: "Erro interno",
      });
    }
  },
);

// BUSCAR POSTS
router.get(
  "/posts",
  optionalAuthMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const musicaId = req.query.musicaId
        ? Number(req.query.musicaId)
        : undefined;

      const posts = await prisma.post.findMany({
        where: musicaId
          ? {
            musicaId,
          }
          : undefined,

        orderBy: {
          dataCriacao: "desc",
        },

        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              username: true,
              foto: true,
            },
          },

          musica: {
            include: {
              artista: true,
              posts: {
                select: {
                  nota: true,
                },
              },
            },
          },

          _count: {
            select: {
              curtidas: true,
              comentarios: true,
            },
          },
        },
      });

      const postsComCurtida = await Promise.all(
        posts.map(async (post) => {
          let curtidoPorMim = false;

          if (req.usuarioId) {
            const curtida = await prisma.curtida.findUnique({
              where: {
                usuarioId_postId: {
                  usuarioId: req.usuarioId,
                  postId: post.id,
                },
              },
            });

            curtidoPorMim = !!curtida;
          }

          return {
            ...post,
            curtidoPorMim,
          };
        }),
      );

      const postsFormatados = postsComCurtida.map((post) => {
        const quantidadeAvaliacoes = post.musica.posts.length;

        const media =
          quantidadeAvaliacoes > 0
            ? post.musica.posts.reduce(
              (total, avaliacao) => total + avaliacao.nota,
              0
            ) / quantidadeAvaliacoes
            : 0;

        return {
          ...post,

          musica: {
            ...post.musica,
            nota: Number(media.toFixed(1)),
            avaliacoes: quantidadeAvaliacoes,
            posts: undefined,
          },
        };
      });

      return res.status(200).json(postsFormatados);
    } catch (error) {
      console.error("Erro ao listar posts", error);

      return res.status(500).json({
        error: "Erro interno",
      });
    }
  },
);

// BUSCAR MINHAS AVALIAÇÕES
router.get(
  "/usuarios/me/posts",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId!;

      const posts = await prisma.post.findMany({
        where: {
          usuarioId,
        },

        orderBy: {
          dataCriacao: "desc",
        },

        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              username: true,
              foto: true,
            },
          },

          musica: {
            include: {
              artista: true,
              posts: {
                select: {
                  nota: true,
                },
              },
            },
          },

          _count: {
            select: {
              curtidas: true,
              comentarios: true,
            },
          },
        },
      });

      return res.status(200).json(posts);
    } catch (error) {
      console.error("Erro ao buscar minhas avaliações", error);

      return res.status(500).json({
        error: "Erro interno",
      });
    }
  },
);

export default router;
