import { Router, Request, Response } from "express";

import prisma from "../prismaClient";
import {
  optionalAuthMiddleware,
  authMiddleware,
  AuthRequest,
} from "../middleware/authMiddleware";

const router = Router();

function notaValida(nota: unknown): nota is number {
  return typeof nota === "number" && Number.isFinite(nota) && nota >= 1 && nota <= 5 && Number.isInteger(nota * 2);
}

// CRIAR UM POST
router.post(
  "/posts",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { musicaId, nota, texto } = req.body;

      const idMusica = Number(musicaId);
      if (!Number.isInteger(idMusica) || idMusica <= 0 || !notaValida(nota) || typeof texto !== "string" || !texto.trim()) {
        return res.status(400).json({
          error: "Informe uma música válida, uma nota de 1 a 5 em intervalos de 0,5 e um texto",
        });
      }

      if (texto.trim().length > 500) {
        return res.status(400).json({ error: "A publicação pode ter no máximo 500 caracteres" });
      }

      const musica = await prisma.musica.findUnique({
        where: {
          id: idMusica,
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
          musicaId: idMusica,
          nota,
          texto: texto.trim(),
        },
      });

      return res.status(201).json(post);
    } catch (error) {
      console.error("Erro ao criar post", error);

      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return res.status(409).json({
          error: "Você já avaliou esta música. Edite sua avaliação existente.",
        });
      }

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

      if (musicaId !== undefined && (!Number.isInteger(musicaId) || musicaId <= 0)) {
        return res.status(400).json({ error: "ID de música inválido" });
      }

      const somenteSeguindo = req.query.seguindo === "true";

      let usuariosSeguidos: number[] = [];

      if (somenteSeguindo) {
        if (!req.usuarioId) {
          return res.status(401).json({
            error: "Faça login para ver as publicações de quem você segue.",
          });
        }

        const seguindo = await prisma.seguidor.findMany({
          where: {
            seguidorId: req.usuarioId,
          },
          select: {
            seguidoId: true,
          },
        });

        usuariosSeguidos = seguindo.map(
          (relacao) => relacao.seguidoId
        );
      }

      const posts = await prisma.post.findMany({
        where: {
          ...(musicaId !== undefined && { musicaId }),

          ...(somenteSeguindo && {
            usuarioId: {
              in: usuariosSeguidos,
            },
          }),
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

      const curtidas = req.usuarioId && posts.length > 0
        ? await prisma.curtida.findMany({
            where: {
              usuarioId: req.usuarioId,
              postId: { in: posts.map((post) => post.id) },
            },
            select: { postId: true },
          })
        : [];
      const postsCurtidos = new Set(curtidas.map((curtida) => curtida.postId));
      const postsComCurtida = posts.map((post) => ({
        ...post,
        curtidoPorMim: postsCurtidos.has(post.id),
      }));

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

// BUSCAR UM POST PELO ID
router.get(
  "/posts/:id",
  optionalAuthMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const post = await prisma.post.findUnique({
        where: { id },
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
                select: { nota: true },
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

      if (!post) {
        return res.status(404).json({
          error: "Post não encontrado",
        });
      }

      const quantidadeAvaliacoes = post.musica.posts.length;

      const media =
        quantidadeAvaliacoes > 0
          ? post.musica.posts.reduce(
            (total, avaliacao) => total + avaliacao.nota,
            0
          ) / quantidadeAvaliacoes
          : 0;

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

      return res.status(200).json({
        ...post,
        curtidoPorMim,
        musica: {
          ...post.musica,
          nota: Number(media.toFixed(1)),
          avaliacoes: quantidadeAvaliacoes,
          posts: undefined,
        },
      });
    } catch (error) {
      console.error("Erro ao buscar post:", error);

      return res.status(500).json({
        error: "Erro interno",
      });
    }
  }
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

      const curtidas = await prisma.curtida.findMany({
        where: {
          usuarioId,
          postId: {
            in: posts.map((post) => post.id),
          },
        },
        select: {
          postId: true,
        },
      });

      const postsCurtidos = new Set(
        curtidas.map((curtida) => curtida.postId)
      );

      const postsFormatados = posts.map((post) => ({
        ...post,
        curtidoPorMim: postsCurtidos.has(post.id),
      }));

      return res.status(200).json(postsFormatados);
    } catch (error) {
      console.error("Erro ao buscar minhas avaliações", error);

      return res.status(500).json({
        error: "Erro interno",
      });
    }
  },
);

// EDITAR UM POST
router.patch(
  "/posts/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const usuarioId = req.usuarioId!;
      const { texto, nota } = req.body;

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "ID inválido" });
      }

      if (!notaValida(nota)) {
        return res.status(400).json({
          error: "A nota deve estar entre 1 e 5, usando intervalos de 0,5",
        });
      }

      if (texto !== null && typeof texto !== "string") {
        return res.status(400).json({
          error: "O texto deve ser uma string ou null",
        });
      }

      if (typeof texto === "string" && texto.trim().length > 500) {
        return res.status(400).json({ error: "A publicação pode ter no máximo 500 caracteres" });
      }

      const post = await prisma.post.findUnique({
        where: { id },
      });

      if (!post) {
        return res.status(404).json({ error: "Post não encontrado" });
      }

      if (post.usuarioId !== usuarioId) {
        return res.status(403).json({
          error: "Você não pode editar esta avaliação",
        });
      }

      const postAtualizado = await prisma.post.update({
        where: { id },
        data: {
          texto: typeof texto === "string" ? texto.trim() : "",
          nota,
          editado: true,
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

      return res.status(200).json(postAtualizado);
    } catch (error) {
      console.error("Erro ao editar post:", error);

      return res.status(500).json({
        error: "Erro interno ao editar avaliação",
      });
    }
  }
);

// EXCLUIR UM POST
router.delete(
  "/posts/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const usuarioId = req.usuarioId!;

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const post = await prisma.post.findUnique({
        where: { id },
      });

      if (!post) {
        return res.status(404).json({ error: "Publicação não encontrada" });
      }

      if (post.usuarioId !== usuarioId) {
        return res.status(403).json({
          error: "Você não pode excluir esta publicação",
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.curtida.deleteMany({
          where: { postId: id },
        });

        await tx.comentario.deleteMany({
          where: { postId: id },
        });

        await tx.post.delete({
          where: { id },
        });
      });

      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir post:", error);

      return res.status(500).json({
        error: "Erro interno ao excluir publicação",
      });
    }
  }
);

export default router;
