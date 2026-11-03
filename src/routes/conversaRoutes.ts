import { Response, Router } from "express";
import prisma from "../prismaClient";
import { enviarPushParaUsuario } from "../services/pushNotificationService";
import { AuthRequest, authMiddleware } from "../middleware/authMiddleware";

const router = Router();
const tamanhoPagina = 50;

const selecaoUsuario = {
  id: true,
  nome: true,
  username: true,
  foto: true,
};

function resumirConversa(conversa: any, usuarioId: number) {
  const outroUsuario = conversa.usuarioUmId === usuarioId
    ? conversa.usuarioDois
    : conversa.usuarioUm;

  return {
    id: conversa.id,
    criadaEm: conversa.criadaEm,
    atualizadaEm: conversa.atualizadaEm,
    outroUsuario,
    ultimaMensagem: conversa.mensagens[0] ?? null,
    mensagensNaoLidas: conversa._count.mensagens,
  };
}

// Lista apenas as conversas das quais o usuário autenticado participa.
router.get("/conversas", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const usuarioId = req.usuarioId!;
    const conversas = await prisma.conversaPrivada.findMany({
      where: { OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }] },
      include: {
        usuarioUm: { select: selecaoUsuario },
        usuarioDois: { select: selecaoUsuario },
        mensagens: {
          take: 1,
          orderBy: { id: "desc" },
          select: { id: true, texto: true, remetenteId: true, criadaEm: true, lidaEm: true },
        },
        _count: {
          select: {
            mensagens: {
              where: { remetenteId: { not: usuarioId }, lidaEm: null },
            },
          },
        },
      },
      orderBy: { atualizadaEm: "desc" },
    });

    return res.status(200).json(conversas.map((conversa) => resumirConversa(conversa, usuarioId)));
  } catch (error) {
    console.error("Erro ao listar conversas privadas:", error);
    return res.status(500).json({ error: "Não foi possível carregar suas conversas." });
  }
});

// Abre uma conversa existente ou cria uma conversa individual com outra pessoa.
router.post("/conversas", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const usuarioId = req.usuarioId!;
    const outroUsuarioId = Number(req.body?.usuarioId);

    if (!Number.isInteger(outroUsuarioId) || outroUsuarioId <= 0) {
      return res.status(400).json({ error: "Informe uma pessoa válida para iniciar a conversa." });
    }
    if (outroUsuarioId === usuarioId) {
      return res.status(400).json({ error: "Não é possível iniciar uma conversa com sua própria conta." });
    }

    const outroUsuarioExiste = await prisma.usuario.findUnique({
      where: { id: outroUsuarioId },
      select: { id: true },
    });
    if (!outroUsuarioExiste) {
      return res.status(404).json({ error: "Pessoa não encontrada." });
    }

    const [usuarioUmId, usuarioDoisId] = [usuarioId, outroUsuarioId].sort((a, b) => a - b);
    const conversa = await prisma.conversaPrivada.upsert({
      where: { usuarioUmId_usuarioDoisId: { usuarioUmId, usuarioDoisId } },
      update: {},
      create: { usuarioUmId, usuarioDoisId },
      include: {
        usuarioUm: { select: selecaoUsuario },
        usuarioDois: { select: selecaoUsuario },
        mensagens: {
          take: 1,
          orderBy: { id: "desc" },
          select: { id: true, texto: true, remetenteId: true, criadaEm: true, lidaEm: true },
        },
        _count: {
          select: {
            mensagens: {
              where: { remetenteId: { not: usuarioId }, lidaEm: null },
            },
          },
        },
      },
    });

    return res.status(200).json(resumirConversa(conversa, usuarioId));
  } catch (error) {
    console.error("Erro ao abrir conversa privada:", error);
    return res.status(500).json({ error: "Não foi possível abrir a conversa." });
  }
});

// Busca as mensagens recentes ou somente as novas após um ID já recebido.
router.get("/conversas/:id/mensagens", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const conversaId = Number(req.params.id);
    const usuarioId = req.usuarioId!;
    const depoisDe = req.query.depoisDe == null ? null : Number(req.query.depoisDe);

    if (!Number.isInteger(conversaId) || conversaId <= 0) {
      return res.status(400).json({ error: "ID de conversa inválido." });
    }
    if (depoisDe !== null && (!Number.isInteger(depoisDe) || depoisDe <= 0)) {
      return res.status(400).json({ error: "Ponto de atualização inválido." });
    }

    const pertence = await prisma.conversaPrivada.findFirst({
      where: {
        id: conversaId,
        OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }],
      },
      select: { id: true },
    });
    if (!pertence) return res.status(404).json({ error: "Conversa não encontrada." });

    const incluirRemetente = { remetente: { select: selecaoUsuario } };
    const mensagens = depoisDe === null
      ? await prisma.mensagemPrivada.findMany({
          where: { conversaId },
          take: tamanhoPagina,
          orderBy: { id: "desc" },
          include: incluirRemetente,
        })
      : await prisma.mensagemPrivada.findMany({
          where: { conversaId, id: { gt: depoisDe } },
          orderBy: { id: "asc" },
          include: incluirRemetente,
        });

    return res.status(200).json(depoisDe === null ? mensagens.reverse() : mensagens);
  } catch (error) {
    console.error("Erro ao buscar mensagens privadas:", error);
    return res.status(500).json({ error: "Não foi possível carregar as mensagens." });
  }
});

// Envia texto simples. Somente os dois participantes podem enviar mensagens.
router.post("/conversas/:id/mensagens", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const conversaId = Number(req.params.id);
    const usuarioId = req.usuarioId!;
    const texto = typeof req.body?.texto === "string" ? req.body.texto.trim() : "";

    if (!Number.isInteger(conversaId) || conversaId <= 0) {
      return res.status(400).json({ error: "ID de conversa inválido." });
    }
    if (!texto) return res.status(400).json({ error: "Escreva uma mensagem." });
    if (texto.length > 2000) return res.status(400).json({ error: "A mensagem pode ter no máximo 2.000 caracteres." });

    const conversa = await prisma.conversaPrivada.findFirst({
      where: {
        id: conversaId,
        OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }],
      },
      select: { id: true, usuarioUmId: true, usuarioDoisId: true },
    });
    if (!conversa) return res.status(404).json({ error: "Conversa não encontrada." });

    const [mensagem] = await prisma.$transaction([
      prisma.mensagemPrivada.create({
        data: { conversaId, remetenteId: usuarioId, texto },
        include: { remetente: { select: selecaoUsuario } },
      }),
      prisma.conversaPrivada.update({
        where: { id: conversaId },
        data: { atualizadaEm: new Date() },
      }),
    ]);

    const destinatarioId = usuarioId === conversa.usuarioUmId
      ? conversa.usuarioDoisId
      : conversa.usuarioUmId;
    void enviarPushParaUsuario(destinatarioId, {
      titulo: "Nova mensagem",
      corpo: "Você recebeu uma mensagem privada na Maré.",
      dados: {
        tipo: "mensagem",
        conversaId,
        nome: mensagem.remetente.nome,
        username: mensagem.remetente.username,
      },
    });

    return res.status(201).json(mensagem);
  } catch (error) {
    console.error("Erro ao enviar mensagem privada:", error);
    return res.status(500).json({ error: "Não foi possível enviar a mensagem." });
  }
});

router.patch("/conversas/:id/lidas", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const conversaId = Number(req.params.id);
    const usuarioId = req.usuarioId!;
    if (!Number.isInteger(conversaId) || conversaId <= 0) {
      return res.status(400).json({ error: "ID de conversa inválido." });
    }

    const conversa = await prisma.conversaPrivada.findFirst({
      where: {
        id: conversaId,
        OR: [{ usuarioUmId: usuarioId }, { usuarioDoisId: usuarioId }],
      },
      select: { id: true },
    });
    if (!conversa) return res.status(404).json({ error: "Conversa não encontrada." });

    const resultado = await prisma.mensagemPrivada.updateMany({
      where: { conversaId, remetenteId: { not: usuarioId }, lidaEm: null },
      data: { lidaEm: new Date() },
    });
    return res.status(200).json({ atualizadas: resultado.count });
  } catch (error) {
    console.error("Erro ao marcar mensagens como lidas:", error);
    return res.status(500).json({ error: "Não foi possível atualizar as mensagens." });
  }
});

export default router;
