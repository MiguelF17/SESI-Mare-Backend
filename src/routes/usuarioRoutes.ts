import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prismaClient";
import jwt from "jsonwebtoken";
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from "../middleware/authMiddleware";
import multer from "multer";
import cloudinary from "../cloudinary";

const router = Router();


const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      return callback(new Error("Envie um arquivo de imagem."));
    }

    callback(null, true);
  },
});

// ATUALIZAR FOTO OU CAPA DO PERFIL
router.patch(
  "/usuarios/me/imagem",
  authMiddleware,
  upload.single("imagem"),

  async (req: AuthRequest, res: Response) => {
    try {

      const usuarioId = req.usuarioId!;
      const { tipo } = req.body;

      console.log(req)
      console.log("Arquivo recebido:", req.file);
      console.log("Campos recebidos:", req.body);

      if (!req.file) {
        return res.status(400).json({
          erro: "Nenhuma imagem foi enviada.",
        });
      }

      if (tipo !== "foto" && tipo !== "capa") {
        return res.status(400).json({
          erro: "O tipo deve ser foto ou capa.",
        });
      }

      const resultado = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        {
          folder: "mare/perfis",
        }
      );

      const usuario = await prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          [tipo]: resultado.secure_url,
        },
        select: {
          id: true,
          foto: true,
          capa: true,
        },
      });

      return res.json(usuario);
    } catch (erro) {
      console.error("Erro ao atualizar imagem:", erro);

      return res.status(500).json({
        erro: "Não foi possível atualizar a imagem.",
      });
    }
  }
);

// CADASTRAR USUÁRIO
router.post("/usuarios", async (req: Request, res: Response) => {
  try {
    // Pega os dados enviados pelo frontend
    const { username, email, senha } = req.body;

    // Verifica se os campos obrigatórios foram preenchidos
    if (!username || !email || !senha) {
      return res.status(400).json({
        error: "Informe username, email e senha",
      });
    }

    const usernameNormalizado = username.trim();
    const emailNormalizado = email.trim().toLowerCase();

    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        OR: [
          { username: usernameNormalizado },
          { email: emailNormalizado },
        ],
      },
    });

    if (usuarioExistente) {
      if (usuarioExistente.email === emailNormalizado) {
        return res.status(409).json({
          error: "Este email já está cadastrado",
        });
      }

      return res.status(409).json({
        error: "Este nome de usuário já está em uso",
      });
    }

    // Transforma a senha em um hash
    const senhaHash = await bcrypt.hash(senha, 10);

    // Cria o usuário no banco
    const usuario = await prisma.usuario.create({
      data: {
        username,
        email: emailNormalizado,
        senhaHash,
      },
    });

    // Não devolvemos a senha/hash para o frontend
    return res.status(201).json({
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
    });
  } catch (error) {
    console.error("Erro ao cadastrar usuário", error);

    return res.status(500).json({
      error: "Erro interno",
    });
  }
});

// LOGAR USUÁRIO
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { login, senha } = req.body;

    if (!login || !senha) {
      return res.status(400).json({
        error: "Informe email ou usuário, e senha",
      });
    }

    const usuario = await prisma.usuario.findFirst({
      where: {
        OR: [{ email: login }, { username: login }],
      },
    });

    if (!usuario) {
      return res.status(401).json({
        error: "Username, email ou senha incorretos",
      });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);

    if (!senhaValida) {
      return res.status(401).json({
        error: "Username, email ou senha incorretos",
      });
    }

    const token = jwt.sign(
      {
        usuarioId: usuario.id,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "8h",
      },
    );

    return res.status(200).json({
      message: "Login realizado com sucesso",
      token,
      usuario: {
        id: usuario.id,
        username: usuario.username,
        email: usuario.email,
        nome: usuario.nome,
        preferenciasConcluidas: usuario.preferenciasConcluidas,
      },
    });
  } catch (error) {
    console.error("Erro ao fazer login", error);

    return res.status(500).json({
      error: "Erro interno",
    });
  }
});

// LISTAR USUÁRIOS
router.get("/usuarios", async (req: Request, res: Response) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    return res.status(200).json(usuarios);
  } catch (error) {
    console.error("Erro ao buscar usuários", error);

    return res.status(500).json({
      error: "Erro interno",
    });
  }
});

// BUSCAR PERFIL PÚBLICO PELO USERNAME
router.get(
  "/usuarios/publico/:username",
  optionalAuthMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const username = String(req.params.username);
      const usuarioLogadoId = req.usuarioId;

      const usuario = await prisma.usuario.findUnique({
        where: {
          username: username,
        },
        select: {
          id: true,
          nome: true,
          username: true,
          foto: true,
          capa: true,
          bio: true,

          _count: {
            select: {
              seguidores: true,
              seguindo: true,
              posts: true,
            },
          },

          posts: {
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
                  _count: {
                    select: {
                      posts: true,
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
          },
        },
      });

      if (!usuario) {
        return res.status(404).json({
          error: "Usuário não encontrado",
        });
      }

      const seguindoPorMim = usuarioLogadoId
        ? !!(await prisma.seguidor.findUnique({
          where: {
            seguidorId_seguidoId: {
              seguidorId: usuarioLogadoId,
              seguidoId: usuario.id,
            },
          },
        }))
        : false;

      return res.status(200).json({
        ...usuario,
        seguindoPorMim,
      });
    } catch (error) {
      console.error("Erro ao buscar perfil público:", error);

      return res.status(500).json({
        error: "Erro interno",
      });
    }
  },
);

// BUSCAR MEU PERFIL
router.get(
  "/usuarios/me",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId!;

      const usuario = await prisma.usuario.findUnique({
        where: {
          id: usuarioId,
        },

        select: {
          id: true,
          nome: true,
          username: true,
          email: true,
          foto: true,
          capa: true,
          bio: true,
          dataCadastro: true,
          preferenciasConcluidas: true,

          _count: {
            select: {
              seguidores: true,
              seguindo: true,
              posts: true,
              comentarios: true,
              salvamentos: true,
            },
          },
        },
      });

      if (!usuario) {
        return res.status(404).json({
          error: "Usuário não encontrado",
        });
      }

      return res.status(200).json(usuario);
    } catch (error) {
      console.error("Erro ao buscar perfil", error);

      return res.status(500).json({
        error: "Erro interno",
      });
    }
  },
);

// EDITAR MEU PERFIL
router.put(
  "/usuarios/me",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId!;

      const { nome, username, bio, foto, capa } = req.body;

      if (username !== undefined && !username.trim()) {
        return res.status(400).json({
          error: "O username não pode ficar vazio",
        });
      }

      // Verifica se o novo username já pertence a outra pessoa
      if (username !== undefined) {
        const usernameExistente = await prisma.usuario.findFirst({
          where: {
            username: username.trim(),
            NOT: {
              id: usuarioId,
            },
          },
        });

        if (usernameExistente) {
          return res.status(409).json({
            error: "Este username já está sendo usado",
          });
        }
      }

      const usuario = await prisma.usuario.update({
        where: {
          id: usuarioId,
        },

        data: {
          ...(nome !== undefined && {
            nome: nome.trim(),
          }),

          ...(username !== undefined && {
            username: username.trim(),
          }),

          ...(bio !== undefined && {
            bio: bio.trim(),
          }),

          ...(foto !== undefined && {
            foto,
          }),

          ...(capa !== undefined && {
            capa,
          }),
        },

        select: {
          id: true,
          nome: true,
          username: true,
          email: true,
          foto: true,
          capa: true,
          bio: true,
        },
      });

      return res.status(200).json(usuario);
    } catch (error) {
      console.error("Erro ao editar perfil", error);

      return res.status(500).json({
        error: "Erro interno",
      });
    }
  },
);

export default router;
