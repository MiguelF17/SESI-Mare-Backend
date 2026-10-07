import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prismaClient";
import jwt from "jsonwebtoken";
import authMiddleware, { AuthRequest } from "../middleware/authMiddleware";

const router = Router();

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

    const emailNormalizado = email.trim().toLowerCase();

    // Verifica se já existe um usuário com esse email
    const usuarioExistente = await prisma.usuario.findUnique({
      where: {
        email: emailNormalizado,
      },
    });

    if (usuarioExistente) {
      return res.status(409).json({
        error: "Este email já está cadastrado",
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
