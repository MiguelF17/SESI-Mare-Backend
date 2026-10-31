import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prismaClient";
import jwt from "jsonwebtoken";
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from "../middleware/authMiddleware";
import multer from "multer";
import cloudinary from "../cloudinary";
import { createHash } from "crypto";
// import { randomBytes } from "crypto"; // usado pelo envio de verificação desativado

const router = Router();

async function gerarNomeUsuario() {
  let nome = "";
  let existe = true;

  while (existe) {
    const numero = Math.floor(1000 + Math.random() * 9000);

    nome = `Usuário${numero}`;

    const usuario = await prisma.usuario.findFirst({
      where: { nome },
    });

    existe = usuario !== null;
  }

  return nome;
}


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
      )

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
    const { username, email, senha } = req.body;

    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof senha !== "string" ||
      !username.trim() ||
      !email.trim() ||
      !senha
    ) {
      return res.status(400).json({
        error: "Informe username, email e senha.",
      });
    }

    const usernameNormalizado = username.trim().toLowerCase();
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
          error: "Este email já está cadastrado.",
        });
      }

      return res.status(409).json({
        error: "Este nome de usuário já está em uso.",
      });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const nome = await gerarNomeUsuario();

    /* Envio de verificação temporariamente desativado.
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiracao = new Date(Date.now() + 60 * 60 * 1000);
    */

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        username: usernameNormalizado,
        email: emailNormalizado,
        senhaHash,
        // A verificação por e-mail está temporariamente desativada.
        emailVerificado: true,
        /* Reativar junto com o envio de email:
        tokenVerificacaoHash: tokenHash,
        tokenVerificacaoExpiraEm: expiracao,
        ultimoEmailVerificacaoEnviadoEm: new Date(),
        */
      },
    });

    /* Envio de verificação temporariamente desativado.
    await enviarEmailVerificacao({ email: emailNormalizado, token });
    */

    return res.status(201).json({
      message: "Conta criada com sucesso!",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        username: usuario.username,
        email: usuario.email,
      },
    });
  } catch (error) {
    console.error("Erro ao cadastrar usuário:", error);

    return res.status(500).json({
      error: "Erro interno ao cadastrar usuário.",
    });
  }
});

// VERIFICAR E-MAIL
router.post("/usuarios/verificar-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (typeof token !== "string" || !token) {
      return res.status(400).json({
        error: "Token de verificação não informado.",
      });
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const usuario = await prisma.usuario.findUnique({
      where: {
        tokenVerificacaoHash: tokenHash,
      },
    });

    if (!usuario) {
      return res.status(400).json({
        error: "Link de verificação inválido ou já utilizado.",
      });
    }

    if (
      !usuario.tokenVerificacaoExpiraEm ||
      usuario.tokenVerificacaoExpiraEm < new Date()
    ) {
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          tokenVerificacaoHash: null,
          tokenVerificacaoExpiraEm: null,
        },
      });

      return res.status(400).json({
        error: "O link de verificação expirou. Solicite um novo e-mail.",
      });
    }

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        emailVerificado: true,
        tokenVerificacaoHash: null,
        tokenVerificacaoExpiraEm: null,
      },
    });

    return res.status(200).json({
      message: "E-mail verificado com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao verificar e-mail:", error);

    return res.status(500).json({
      error: "Não foi possível verificar o e-mail.",
    });
  }
});

/* REENVIAR E-MAIL DE VERIFICAÇÃO — temporariamente desativado.
router.post(
  "/usuarios/reenviar-verificacao",
  async (req: Request, res: Response) => {
    try {
      return res.status(200).json({
        message: "A verificação por e-mail está temporariamente desativada.",
      });
    } catch (error) {
      console.error("Erro ao reenviar verificação:", error);

      return res.status(500).json({
        error: "Não foi possível reenviar o e-mail de verificação.",
      });
    }
  }
);
*/


// LOGAR USUÁRIO
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { login, senha } = req.body;

    if (
      typeof login !== "string" ||
      typeof senha !== "string" ||
      !login.trim() ||
      !senha
    ) {
      return res.status(400).json({
        error: "Informe seu e-mail ou usuário, e senha.",
      });
    }

    const loginNormalizado = login.trim().toLowerCase();

    const usuario = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email: loginNormalizado },
          { username: loginNormalizado },
        ],
      },
    });

    if (!usuario) {
      return res.status(401).json({
        error: "Username, email ou senha incorretos.",
      });
    }

    const senhaValida = await bcrypt.compare(
      senha,
      usuario.senhaHash
    );

    if (!senhaValida) {
      return res.status(401).json({
        error: "Username, email ou senha incorretos.",
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
      orderBy: { username: "asc" },
      select: {
        id: true,
        nome: true,
        username: true,
        foto: true,
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
              curtidas: {
                where: { usuarioId: usuarioLogadoId ?? -1 },
                select: { usuarioId: true },
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

      const { posts, ...dadosUsuario } = usuario;

      return res.status(200).json({
        ...dadosUsuario,
        posts: posts.map(({ curtidas, ...post }) => ({
          ...post,
          curtidoPorMim: curtidas.length > 0,
        })),
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
  "/usuarios/me/notificacoes/preferencias",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.usuarioId! },
        select: {
          notificacoesCurtidas: true,
          notificacoesComentarios: true,
          notificacoesSeguidores: true,
        },
      });

      if (!usuario) return res.status(404).json({ error: "Usuário não encontrado" });

      return res.json({
        curtidas: usuario.notificacoesCurtidas,
        comentarios: usuario.notificacoesComentarios,
        seguidores: usuario.notificacoesSeguidores,
      });
    } catch (error) {
      console.error("Erro ao carregar preferências de notificação:", error);
      return res.status(500).json({ error: "Não foi possível carregar as preferências." });
    }
  },
);

router.put(
  "/usuarios/me/notificacoes/preferencias",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { curtidas, comentarios, seguidores } = req.body;
      if ([curtidas, comentarios, seguidores].some((valor) => typeof valor !== "boolean")) {
        return res.status(400).json({ error: "Informe valores booleanos para cada preferência." });
      }

      await prisma.usuario.update({
        where: { id: req.usuarioId! },
        data: {
          notificacoesCurtidas: curtidas,
          notificacoesComentarios: comentarios,
          notificacoesSeguidores: seguidores,
        },
      });

      return res.json({ curtidas, comentarios, seguidores });
    } catch (error) {
      console.error("Erro ao salvar preferências de notificação:", error);
      return res.status(500).json({ error: "Não foi possível salvar as preferências." });
    }
  },
);

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
            username: username.trim().toLowerCase(),
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
            username: username.trim().toLowerCase(),
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

// BUSCAR POSTS CURTIDOS PELO USUÁRIO LOGADO
router.get(
  "/usuarios/me/curtidas",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId!;

      const posts = await prisma.post.findMany({
        where: {
          curtidas: {
            some: {
              usuarioId,
            },
          },
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
      });

      return res.status(200).json(
        posts.map((post) => ({
          ...post,
          curtidoPorMim: true,
        })),
      );
    } catch (error) {
      console.error("Erro ao buscar posts curtidos:", error);

      return res.status(500).json({
        error: "Não foi possível buscar os posts curtidos.",
      });
    }
  },
);

export default router;
