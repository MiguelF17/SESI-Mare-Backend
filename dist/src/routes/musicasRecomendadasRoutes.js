"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
async function buscarPreferencias(usuarioId) {
    const [generos, artistas] = await Promise.all([
        prismaClient_1.default.usuarioGenero.findMany({
            where: { usuarioId },
            select: { genero: true },
        }),
        prismaClient_1.default.usuarioArtista.findMany({
            where: { usuarioId },
            select: { artistaId: true },
        }),
    ]);
    return {
        generos: generos.map((item) => item.genero),
        artistas: artistas.map((item) => item.artistaId),
    };
}
function criarFiltros(preferencias) {
    const filtros = [];
    if (preferencias.generos.length > 0) {
        filtros.push({ genero: { in: preferencias.generos } });
    }
    if (preferencias.artistas.length > 0) {
        filtros.push({ artistaId: { in: preferencias.artistas } });
    }
    return filtros;
}
function obterDiaAtual() {
    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    const parte = (tipo) => partes.find((item) => item.type === tipo)?.value ?? "";
    return `${parte("year")}-${parte("month")}-${parte("day")}`;
}
router.get("/musicas/recomendadas", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const preferencias = await buscarPreferencias(usuarioId);
        const filtros = criarFiltros(preferencias);
        const musicas = await prismaClient_1.default.musica.findMany({
            where: {
                ...(filtros.length ? { OR: filtros } : {}),
                posts: { none: { usuarioId } },
            },
            include: {
                artista: true,
                _count: { select: { posts: true } },
            },
            orderBy: { id: "asc" },
            take: 50,
        });
        return res.status(200).json(musicas);
    }
    catch (error) {
        console.error("Erro ao buscar recomendações:", error);
        return res.status(500).json({
            error: "Não foi possível buscar músicas recomendadas.",
        });
    }
});
// Escolhe uma recomendação estável durante o dia, sem sugerir música já avaliada.
router.get("/recomendacoes/do-dia", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const preferencias = await buscarPreferencias(usuarioId);
        const filtros = criarFiltros(preferencias);
        const base = {
            posts: { none: { usuarioId } },
        };
        let candidatas = await prismaClient_1.default.musica.findMany({
            where: {
                ...base,
                ...(filtros.length ? { OR: filtros } : {}),
            },
            include: {
                artista: true,
                _count: { select: { posts: true } },
            },
            orderBy: { id: "asc" },
            take: 50,
        });
        const personalizada = candidatas.length > 0 && filtros.length > 0;
        // Se as preferências não tiverem opções novas, apresenta uma música ainda não avaliada.
        if (candidatas.length === 0 && filtros.length > 0) {
            candidatas = await prismaClient_1.default.musica.findMany({
                where: base,
                include: {
                    artista: true,
                    _count: { select: { posts: true } },
                },
                orderBy: { id: "asc" },
                take: 50,
            });
        }
        if (candidatas.length === 0) {
            return res.status(200).json({ musica: null, dia: obterDiaAtual(), personalizada: false });
        }
        const dia = obterDiaAtual();
        const chave = `${usuarioId}:${dia}`;
        const hash = [...chave].reduce((total, caractere) => (total * 31 + caractere.charCodeAt(0)) >>> 0, 7);
        const musica = candidatas[hash % candidatas.length];
        return res.status(200).json({ musica, dia, personalizada });
    }
    catch (error) {
        console.error("Erro ao buscar música do dia:", error);
        return res.status(500).json({ error: "Não foi possível buscar a música do dia." });
    }
});
exports.default = router;
