import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prismaClient";
import jwt from "jsonwebtoken";

const router = Router();

// CADASTRAR USUÁRIO
router.post("/usuarios", async (req: Request, res: Response) => {
	try {
		// Pega os dados enviados pelo frontend
		const { nome, email, senha } = req.body;

		// Verifica se os campos obrigatórios foram preenchidos
		if (!nome || !email || !senha) {
			return res.status(400).json({
				error: "Informe nome, email e senha",
			});
		}

		// Verifica se já existe um usuário com esse email
		const usuarioExistente = await prisma.usuario.findUnique({
			where: {
				email: email,
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
				nome,
				email,
				senhaHash,
			},
		});

		// Não devolvemos a senha/hash para o frontend
		return res.status(201).json({
			id: usuario.id,
			nome: usuario.nome,
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
router.post("/auth/login", async (req: Request, res: Response) => {
	try {
		const { email, senha } = req.body;

		if (!email || !senha) {
			return res.status(400).json({
				error: "Informe email e senha",
			});
		}

		const usuario = await prisma.usuario.findUnique({
			where: {
				email: email,
			},
		});

		if (!usuario) {
			return res.status(401).json({
				error: "Email ou senha incorretos",
			});
		}

		const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);

		if (!senhaValida) {
			return res.status(401).json({
				error: "Email ou senha incorretos",
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
				nome: usuario.nome,
				email: usuario.email,
			},
		});
	} catch (error) {
		console.error("Erro ao fazer login", error);

		return res.status(500).json({
			error: "Erro interno",
		});
	}
});

export default router;
