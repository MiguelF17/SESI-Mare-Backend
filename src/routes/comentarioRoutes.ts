import { Router, Response } from "express";
import prisma from "../prismaClient";
import {
  authMiddleware,
  optionalAuthMiddleware,
  AuthRequest,
} from "../middleware/authMiddleware";

const router = Router();

// Criar comentário
router.post(
  "/posts/:postId/comentarios",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const postId = Number(req.params.postId);
      const usuarioId = req.usuarioId!;
      const { texto, respostaAId: respostaAIdInformada } = req.body;

      if (!Number.isInteger(postId) || postId <= 0) {
        return res.status(400).json({ error: "ID de publicação inválido" });
      }

      if (typeof texto !== "string" || !texto.trim()) {
        return res.status(400).json({
          error: "Informe o texto do comentário",
        });
      }

      if (texto.trim().length > 500) {
        return res.status(400).json({
          error: "O comentário pode ter no máximo 500 caracteres",
        });
      }

      const respostaAId = respostaAIdInformada == null
        ? null
        : Number(respostaAIdInformada);

      if (respostaAId !== null && (!Number.isInteger(respostaAId) || respostaAId <= 0)) {
        return res.status(400).json({ error: "ID do comentário respondido inválido" });
      }

      const post = await prisma.post.findUnique({
        where: {
          id: postId,
        },
      });

      if (!post) {
        return res.status(404).json({
          error: "Post não encontrado",
        });
      }

      let comentarioRespondido: {
        id: number;
        postId: number;
        respostaAId: number | null;
        usuarioId: number;
      } | null = null;
      if (respostaAId !== null) {
        comentarioRespondido = await prisma.comentario.findUnique({
          where: { id: respostaAId },
          select: { id: true, postId: true, respostaAId: true, usuarioId: true },
        });

        if (!comentarioRespondido) {
          return res.status(404).json({ error: "Comentário respondido não encontrado" });
        }

        if (comentarioRespondido.postId !== postId) {
          return res.status(400).json({
            error: "O comentário respondido pertence a outra publicação",
          });
        }

        if (comentarioRespondido.respostaAId !== null) {
          return res.status(400).json({
            error: "Respostas só podem ser feitas em comentários principais",
          });
        }
      }

      const comentario = await prisma.comentario.create({
        data: {
          usuarioId,
          postId,
          texto: texto.trim(),
          respostaAId,
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
        },
      });

      const usuarioNotificado = comentarioRespondido?.usuarioId ?? post.usuarioId;
      const preferencias = usuarioNotificado !== usuarioId
        ? await prisma.usuario.findUnique({
            where: { id: usuarioNotificado },
            select: { notificacoesComentarios: true },
          })
        : null;
      if (usuarioNotificado !== usuarioId && preferencias?.notificacoesComentarios) {
        await prisma.notificacao.create({
          data: {
            tipo: "comentario",
            mensagem: comentarioRespondido
              ? "respondeu ao seu comentário"
              : "comentou na sua publicação",
            usuarioId: usuarioNotificado,
            atorId: usuarioId,
            postId: post.id,
            comentarioId: comentario.id,
          },
        });
      }

      return res.status(201).json(comentario);
    } catch (error) {
      console.error("Erro ao criar comentário", error);

      return res.status(500).json({
        error: "Erro interno",
      });
    }
  },
);

// Listar comentários de um post
router.get(
  "/posts/:postId/comentarios",
  optionalAuthMiddleware,
  async (req: AuthRequest, res: Response) => {
  try {
    const postId = Number(req.params.postId);

    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({ error: "ID de publicação inválido" });
    }

    const usuarioCurtida = req.usuarioId ?? -1;

    const comentarios = await prisma.comentario.findMany({
      where: {
        postId,
        respostaAId: null,
      },
      orderBy: {
        dataCriacao: "asc",
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
        _count: { select: { curtidas: true } },
        curtidas: {
          where: { usuarioId: usuarioCurtida },
          select: { usuarioId: true },
        },
        respostas: {
          orderBy: { dataCriacao: "asc" },
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                username: true,
                foto: true,
              },
            },
            _count: { select: { curtidas: true } },
            curtidas: {
              where: { usuarioId: usuarioCurtida },
              select: { usuarioId: true },
            },
          },
        },
      },
    });

    const comentariosFormatados = comentarios.map(({ curtidas, respostas, ...comentario }) => ({
      ...comentario,
      curtidoPorMim: curtidas.length > 0,
      respostas: respostas.map(({ curtidas: curtidasResposta, ...resposta }) => ({
        ...resposta,
        curtidoPorMim: curtidasResposta.length > 0,
      })),
    }));

    return res.status(200).json(comentariosFormatados);
  } catch (error) {
    console.error("Erro ao listar comentários", error);

    return res.status(500).json({
      error: "Erro interno",
    });
  }
  },
);

// Curtir comentário (idempotente para evitar erros em cliques repetidos).
router.post(
  "/comentarios/:id/curtir",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const comentarioId = Number(req.params.id);
      const usuarioId = req.usuarioId!;

      if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
        return res.status(400).json({ error: "ID de comentário inválido" });
      }

      const comentario = await prisma.comentario.findUnique({
        where: { id: comentarioId },
        select: { id: true },
      });

      if (!comentario) {
        return res.status(404).json({ error: "Comentário não encontrado" });
      }

      await prisma.comentarioCurtida.upsert({
        where: { usuarioId_comentarioId: { usuarioId, comentarioId } },
        create: { usuarioId, comentarioId },
        update: {},
      });

      return res.status(200).json({ message: "Comentário curtido" });
    } catch (error) {
      console.error("Erro ao curtir comentário", error);
      return res.status(500).json({ error: "Erro interno" });
    }
  },
);

router.delete(
  "/comentarios/:id/curtir",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const comentarioId = Number(req.params.id);
      const usuarioId = req.usuarioId!;

      if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
        return res.status(400).json({ error: "ID de comentário inválido" });
      }

      await prisma.comentarioCurtida.deleteMany({
        where: { usuarioId, comentarioId },
      });

      return res.status(200).json({ message: "Curtida removida" });
    } catch (error) {
      console.error("Erro ao remover curtida do comentário", error);
      return res.status(500).json({ error: "Erro interno" });
    }
  },
);

// Excluir comentário
router.delete(
  "/comentarios/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const comentarioId = Number(req.params.id);
      const usuarioId = req.usuarioId!;

      const comentario = await prisma.comentario.findUnique({
        where: {
          id: comentarioId,
        },
      });

      if (!comentario) {
        return res.status(404).json({
          error: "Comentário não encontrado",
        });
      }

      if (comentario.usuarioId !== usuarioId) {
        return res.status(403).json({
          error: "Você não pode excluir este comentário",
        });
      }

      await prisma.comentario.delete({
        where: {
          id: comentarioId,
        },
      });

      return res.status(200).json({
        message: "Comentário excluído com sucesso",
      });
    } catch (error) {
      console.error("Erro ao excluir comentário", error);

      return res.status(500).json({
        error: "Erro interno",
      });
    }
  },
);


// BUSCAR MEUS COMENTÁRIOS
router.get(
  "/usuarios/me/comentarios",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId!;

      const comentarios = await prisma.comentario.findMany({
        where: {
          usuarioId,
        },

        orderBy: {
          dataCriacao: "desc",
        },

        include: {
          // Autor do comentário
          usuario: {
            select: {
              id: true,
              nome: true,
              username: true,
              foto: true,
            },
          },

          // Publicação original que recebeu o comentário
          post: {
            include: {
              // Autor da publicação
              usuario: {
                select: {
                  id: true,
                  nome: true,
                  username: true,
                  foto: true,
                },
              },

              // Música e artista avaliados
              musica: {
                include: {
                  artista: true,
                },
              },

              // Quantidade de curtidas e comentários
              _count: {
                select: {
                  curtidas: true,
                  comentarios: true,
                },
              },

              // Verifica se o usuário logado curtiu a publicação
              curtidas: {
                where: {
                  usuarioId,
                },
                select: {
                  usuarioId: true,
                },
              },
            },
          },
        },
      });

      // Formata a resposta para o frontend
      const comentariosFormatados = comentarios.map((comentario) => {
        const { curtidas, ...post } = comentario.post;

        return {
          ...comentario,

          post: {
            ...post,

            // O PostCard espera um booleano
            curtidoPorMim: curtidas.length > 0,
          },
        };
      });

      return res.status(200).json(comentariosFormatados);
    } catch (error) {
      console.error("Erro ao buscar meus comentários", error);

      return res.status(500).json({
        error: "Erro interno ao buscar comentários",
      });
    }
  },
);

// BUSCAR COMENTÁRIOS DE UM USUÁRIO PELO ID
router.get(
  "/usuarios/:id/comentarios",
  async (req, res: Response) => {
    try {
      const usuarioId = Number(req.params.id);

      if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
        return res.status(400).json({
          error: "ID de usuário inválido",
        });
      }

      const comentarios = await prisma.comentario.findMany({
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
          post: {
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
              curtidas: {
                select: {
                  usuarioId: true,
                },
                where: {
                  usuarioId: -1,
                },
              },
            },
          },
        },
      });

      const comentariosFormatados = comentarios.map((comentario) => {
        const { curtidas, ...post } = comentario.post;

        return {
          ...comentario,
          post: {
            ...post,
            curtidoPorMim: curtidas.length > 0,
          },
        };
      });

      return res.status(200).json(comentariosFormatados);
    } catch (error) {
      console.error("Erro ao buscar comentários do usuário:", error);

      return res.status(500).json({
        error: "Erro interno ao buscar comentários",
      });
    }
  },
);

// Editar comentário
router.patch(
  "/comentarios/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const comentarioId = Number(req.params.id);
      const usuarioId = req.usuarioId!;
      const { texto } = req.body;

      if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
        return res.status(400).json({
          error: "ID de comentário inválido",
        });
      }

      if (typeof texto !== "string" || !texto.trim()) {
        return res.status(400).json({
          error: "O comentário não pode ficar vazio",
        });
      }

      if (texto.trim().length > 500) {
        return res.status(400).json({
          error: "O comentário pode ter no máximo 500 caracteres",
        });
      }

      const comentario = await prisma.comentario.findUnique({
        where: { id: comentarioId },
      });

      if (!comentario) {
        return res.status(404).json({
          error: "Comentário não encontrado",
        });
      }

      if (comentario.usuarioId !== usuarioId) {
        return res.status(403).json({
          error: "Você não pode editar este comentário",
        });
      }

      const comentarioAtualizado = await prisma.comentario.update({
        where: { id: comentarioId },
        data: {
          texto: texto.trim(),
          editado: true,
        },
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              foto: true,
            },
          },
        },
      });

      return res.status(200).json(comentarioAtualizado);
    } catch (error) {
      console.error("Erro ao editar comentário", error);

      return res.status(500).json({
        error: "Erro interno ao editar comentário",
      });
    }
  },
);


export default router;
