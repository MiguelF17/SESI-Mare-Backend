import { Router, Response } from "express";
import prisma from "../prismaClient";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

// Criar comentário
router.post(
  "/posts/:postId/comentarios",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const postId = Number(req.params.postId);
      const usuarioId = req.usuarioId!;
      const { texto } = req.body;

      if (!texto) {
        return res.status(400).json({
          error: "Informe o texto do comentário",
        });
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

      const comentario = await prisma.comentario.create({
        data: {
          usuarioId,
          postId,
          texto,
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

      // Notifica o autor do post, exceto quando comenta na própria publicação
      if (post.usuarioId !== usuarioId) {
        await prisma.notificacao.create({
          data: {
            tipo: "comentario",
            mensagem: "comentou na sua publicação",
            usuarioId: post.usuarioId,
            atorId: usuarioId,
            postId: post.id,
          },
        });
      }

      return res.status(201).json(comentario);



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
router.get("/posts/:postId/comentarios", async (req, res: Response) => {
  try {
    const postId = Number(req.params.postId);

    const comentarios = await prisma.comentario.findMany({
      where: {
        postId,
      },
      orderBy: {
        dataCriacao: "asc",
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

    return res.status(200).json(comentarios);
  } catch (error) {
    console.error("Erro ao listar comentários", error);

    return res.status(500).json({
      error: "Erro interno",
    });
  }
});

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


export default router;
