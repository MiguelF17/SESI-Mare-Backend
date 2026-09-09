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

			if (nota < 1 || nota > 5) {
				return res.status(400).json({
					error: "A nota deve estar entre 1 e 5",
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
			const posts = await prisma.post.findMany({
				orderBy: {
					dataCriacao: "desc",
				},
				include: {
					usuario: {
						select: {
							id: true,
							nome: true,
							foto: true,
						},
					},
					musica: true,
					_count: {
						select: {
							curtidas: true,
						},
					},
				},
			});

            // Verifica se a pessoa que está vendo o post é a mesma que curtiu
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

			return res.status(200).json(postsComCurtida);
		} catch (error) {
			console.error("Erro ao listar posts", error);

			return res.status(500).json({
				error: "Erro interno",
			});
		}
	},
);

export default router;
