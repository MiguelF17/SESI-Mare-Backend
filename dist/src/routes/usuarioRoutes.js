"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prismaClient_1 = __importDefault(require("../prismaClient"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = __importDefault(require("../cloudinary"));
const crypto_1 = require("crypto");
const emailService_1 = require("../services/emailService");
const router = (0, express_1.Router)();
async function gerarNomeUsuario() {
    let nome = "";
    let existe = true;
    while (existe) {
        const numero = Math.floor(1000 + Math.random() * 9000);
        nome = `Usuário${numero}`;
        const usuario = await prismaClient_1.default.usuario.findFirst({
            where: { nome },
        });
        existe = usuario !== null;
    }
    return nome;
}
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
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
const tratarErroUpload = (erro, _req, res, next) => {
    if (erro instanceof multer_1.default.MulterError && erro.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
            erro: "A imagem ultrapassa o limite de 5 MB. Escolha um arquivo menor.",
        });
    }
    if (erro instanceof Error && erro.message === "Envie um arquivo de imagem.") {
        return res.status(400).json({ erro: erro.message });
    }
    return next(erro);
};
// ATUALIZAR FOTO OU CAPA DO PERFIL
router.patch("/usuarios/me/imagem", authMiddleware_1.authMiddleware, upload.single("imagem"), tratarErroUpload, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const { tipo } = req.body;
        console.info("Recebendo imagem de perfil", {
            usuarioId,
            tipo,
            tamanhoBytes: req.file?.size,
            formato: req.file?.mimetype,
        });
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
        const resultado = await cloudinary_1.default.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`, {
            folder: "mare/perfis",
        });
        const usuario = await prismaClient_1.default.usuario.update({
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
    }
    catch (erro) {
        console.error("Erro ao atualizar imagem:", erro);
        return res.status(500).json({
            erro: "Não foi possível atualizar a imagem.",
        });
    }
});
// Remove a foto ou a capa do próprio perfil, voltando ao visual padrão.
router.delete("/usuarios/me/imagem", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const tipoRecebido = req.body?.tipo;
        if (tipoRecebido !== "foto" && tipoRecebido !== "capa") {
            return res.status(400).json({ erro: "O tipo deve ser foto ou capa." });
        }
        const tipo = tipoRecebido;
        const usuario = await prismaClient_1.default.usuario.findUnique({
            where: { id: req.usuarioId },
            select: { foto: true, capa: true },
        });
        if (!usuario) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }
        const urlImagem = usuario[tipo];
        const atualizado = await prismaClient_1.default.usuario.update({
            where: { id: req.usuarioId },
            data: { [tipo]: null },
            select: { foto: true, capa: true },
        });
        if (urlImagem) {
            try {
                const url = new URL(urlImagem);
                const caminhoCloudinary = `/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
                // Só apaga arquivos do Cloudinary desta conta; fotos antigas podem vir de outros serviços.
                if (url.hostname === "res.cloudinary.com" && url.pathname.includes(caminhoCloudinary)) {
                    const caminhoArquivo = url.pathname.split(caminhoCloudinary)[1]?.replace(/^v\d+\//, "");
                    const publicId = caminhoArquivo?.replace(/\.[^/.]+$/, "");
                    if (publicId) {
                        await cloudinary_1.default.uploader.destroy(publicId, { resource_type: "image" });
                    }
                }
            }
            catch (erroCloudinary) {
                // A foto já foi removida do perfil; evita falhar se o arquivo antigo não existir.
                console.warn("Não foi possível limpar o arquivo antigo do Cloudinary:", erroCloudinary);
            }
        }
        return res.json(atualizado);
    }
    catch (erro) {
        console.error("Erro ao remover imagem do perfil:", erro);
        return res.status(500).json({ erro: "Não foi possível remover a imagem." });
    }
});
// CADASTRAR USUÁRIO
router.post("/usuarios", async (req, res) => {
    try {
        const { username, email, senha } = req.body;
        if (typeof username !== "string" ||
            typeof email !== "string" ||
            typeof senha !== "string" ||
            !username.trim() ||
            !email.trim() ||
            !senha) {
            return res.status(400).json({
                error: "Informe username, email e senha.",
            });
        }
        const usernameNormalizado = username.trim().toLowerCase();
        const emailNormalizado = email.trim().toLowerCase();
        const usuarioExistente = await prismaClient_1.default.usuario.findFirst({
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
        const senhaHash = await bcryptjs_1.default.hash(senha, 10);
        const nome = await gerarNomeUsuario();
        const token = (0, crypto_1.randomBytes)(32).toString("hex");
        const tokenHash = (0, crypto_1.createHash)("sha256")
            .update(token)
            .digest("hex");
        const expiracao = new Date(Date.now() + 60 * 60 * 1000);
        const usuario = await prismaClient_1.default.usuario.create({
            data: {
                nome,
                username: usernameNormalizado,
                email: emailNormalizado,
                senhaHash,
                emailVerificado: false,
                tokenVerificacaoHash: tokenHash,
                tokenVerificacaoExpiraEm: expiracao,
                ultimoEmailVerificacaoEnviadoEm: new Date(),
            },
        });
        try {
            await (0, emailService_1.enviarEmailVerificacao)({
                email: emailNormalizado,
                token,
            });
        }
        catch (erroEmail) {
            console.error("Erro ao enviar e-mail de verificação:", erroEmail);
            return res.status(502).json({
                error: "Sua conta foi criada, mas não conseguimos enviar o e-mail. Tente reenviar a verificação.",
                emailPendente: true,
            });
        }
        return res.status(201).json({
            message: "Conta criada! Verifique seu e-mail para ativar sua conta.",
            emailPendente: true,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                username: usuario.username,
                email: usuario.email,
            },
        });
    }
    catch (error) {
        console.error("Erro ao cadastrar usuário:", error);
        return res.status(500).json({
            error: "Erro interno ao cadastrar usuário.",
        });
    }
});
// VERIFICAR E-MAIL
router.post("/usuarios/verificar-email", async (req, res) => {
    try {
        const { token } = req.body;
        if (typeof token !== "string" || !token) {
            return res.status(400).json({
                error: "Token de verificação não informado.",
            });
        }
        const tokenHash = (0, crypto_1.createHash)("sha256")
            .update(token)
            .digest("hex");
        const usuario = await prismaClient_1.default.usuario.findUnique({
            where: {
                tokenVerificacaoHash: tokenHash,
            },
        });
        if (!usuario) {
            return res.status(400).json({
                error: "Link de verificação inválido ou já utilizado.",
            });
        }
        if (!usuario.tokenVerificacaoExpiraEm ||
            usuario.tokenVerificacaoExpiraEm < new Date()) {
            await prismaClient_1.default.usuario.update({
                where: { id: usuario.id },
                data: {
                    emailPendente: null,
                    tokenVerificacaoHash: null,
                    tokenVerificacaoExpiraEm: null,
                },
            });
            return res.status(400).json({
                error: "O link de verificação expirou. Solicite um novo e-mail.",
            });
        }
        await prismaClient_1.default.usuario.update({
            where: { id: usuario.id },
            data: {
                ...(usuario.emailPendente ? { email: usuario.emailPendente, emailPendente: null } : {}),
                emailVerificado: true,
                tokenVerificacaoHash: null,
                tokenVerificacaoExpiraEm: null,
            },
        });
        return res.status(200).json({
            message: "E-mail verificado com sucesso!",
        });
    }
    catch (error) {
        console.error("Erro ao verificar e-mail:", error);
        return res.status(500).json({
            error: "Não foi possível verificar o e-mail.",
        });
    }
});
// Solicita a troca do e-mail. A alteração só entra em vigor após confirmar o link enviado.
router.patch("/usuarios/me/email", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const novoEmail = typeof req.body?.novoEmail === "string" ? req.body.novoEmail.trim().toLowerCase() : "";
        const senhaAtual = typeof req.body?.senhaAtual === "string" ? req.body.senhaAtual : "";
        if (!/^\S+@\S+\.\S+$/.test(novoEmail) || !senhaAtual) {
            return res.status(400).json({ error: "Informe um e-mail válido e sua senha atual." });
        }
        const usuario = await prismaClient_1.default.usuario.findUnique({ where: { id: req.usuarioId } });
        if (!usuario || !(await bcryptjs_1.default.compare(senhaAtual, usuario.senhaHash))) {
            return res.status(401).json({ error: "A senha atual está incorreta." });
        }
        if (novoEmail === usuario.email) {
            return res.status(400).json({ error: "Esse já é o e-mail atual da sua conta." });
        }
        const emailEmUso = await prismaClient_1.default.usuario.findFirst({
            where: { OR: [{ email: novoEmail }, { emailPendente: novoEmail }], NOT: { id: usuario.id } },
            select: { id: true },
        });
        if (emailEmUso)
            return res.status(409).json({ error: "Esse e-mail já está em uso." });
        const token = (0, crypto_1.randomBytes)(32).toString("hex");
        await prismaClient_1.default.usuario.update({
            where: { id: usuario.id },
            data: {
                emailPendente: novoEmail,
                tokenVerificacaoHash: (0, crypto_1.createHash)("sha256").update(token).digest("hex"),
                tokenVerificacaoExpiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
        try {
            await (0, emailService_1.enviarEmailVerificacao)({ email: novoEmail, token, alteracao: true });
        }
        catch (erroEmail) {
            await prismaClient_1.default.usuario.update({
                where: { id: usuario.id },
                data: { emailPendente: null, tokenVerificacaoHash: null, tokenVerificacaoExpiraEm: null },
            });
            throw erroEmail;
        }
        return res.json({ message: "Enviamos um link para confirmar seu novo e-mail." });
    }
    catch (error) {
        console.error("Erro ao solicitar troca de e-mail:", error);
        return res.status(500).json({ error: "Não foi possível solicitar a troca de e-mail." });
    }
});
// Troca a senha após confirmar a senha atual e os critérios mínimos de segurança.
router.patch("/usuarios/me/senha", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const senhaAtual = typeof req.body?.senhaAtual === "string" ? req.body.senhaAtual : "";
        const novaSenha = typeof req.body?.novaSenha === "string" ? req.body.novaSenha : "";
        if (!senhaAtual || novaSenha.length < 8 || novaSenha.length > 128 || !/[a-z]/.test(novaSenha) || !/[A-Z]/.test(novaSenha) || !/[0-9]/.test(novaSenha) || !/[^A-Za-z0-9]/.test(novaSenha)) {
            return res.status(400).json({ error: "A nova senha deve ter de 8 a 128 caracteres, com maiúscula, minúscula, número e símbolo." });
        }
        const usuario = await prismaClient_1.default.usuario.findUnique({ where: { id: req.usuarioId } });
        if (!usuario || !(await bcryptjs_1.default.compare(senhaAtual, usuario.senhaHash))) {
            return res.status(401).json({ error: "A senha atual está incorreta." });
        }
        if (await bcryptjs_1.default.compare(novaSenha, usuario.senhaHash)) {
            return res.status(400).json({ error: "A nova senha deve ser diferente da atual." });
        }
        await prismaClient_1.default.usuario.update({
            where: { id: usuario.id },
            data: { senhaHash: await bcryptjs_1.default.hash(novaSenha, 10), tokenRedefinicaoSenhaHash: null, tokenRedefinicaoSenhaExpiraEm: null },
        });
        return res.json({ message: "Senha alterada com sucesso." });
    }
    catch (error) {
        console.error("Erro ao alterar senha:", error);
        return res.status(500).json({ error: "Não foi possível alterar a senha." });
    }
});
// REENVIAR E-MAIL DE VERIFICAÇÃO 
router.post("/usuarios/reenviar-verificacao", async (req, res) => {
    try {
        const identificador = req.body.login ??
            req.body.email ??
            req.body.username;
        if (typeof identificador !== "string" ||
            !identificador.trim()) {
            return res.status(400).json({
                error: "Informe seu e-mail ou username.",
            });
        }
        const loginNormalizado = identificador.trim().toLowerCase();
        const usuario = await prismaClient_1.default.usuario.findFirst({
            where: {
                OR: [
                    { email: loginNormalizado },
                    { username: loginNormalizado },
                ],
            },
        });
        if (!usuario || usuario.emailVerificado) {
            return res.status(200).json({
                message: "Se houver uma conta pendente de verificação, enviaremos um e-mail.",
            });
        }
        const intervalo = 60 * 1000;
        if (usuario.ultimoEmailVerificacaoEnviadoEm) {
            const tempoDecorrido = Date.now() -
                usuario.ultimoEmailVerificacaoEnviadoEm.getTime();
            if (tempoDecorrido < intervalo) {
                const segundosRestantes = Math.ceil((intervalo - tempoDecorrido) / 1000);
                return res.status(429).json({
                    error: `Aguarde ${segundosRestantes} segundos para solicitar outro e-mail.`,
                });
            }
        }
        const token = (0, crypto_1.randomBytes)(32).toString("hex");
        const tokenHash = (0, crypto_1.createHash)("sha256")
            .update(token)
            .digest("hex");
        const expiracao = new Date(Date.now() + 60 * 60 * 1000);
        await prismaClient_1.default.usuario.update({
            where: { id: usuario.id },
            data: {
                tokenVerificacaoHash: tokenHash,
                tokenVerificacaoExpiraEm: expiracao,
                ultimoEmailVerificacaoEnviadoEm: new Date(),
            },
        });
        await (0, emailService_1.enviarEmailVerificacao)({
            email: usuario.email,
            token,
        });
        return res.status(200).json({
            message: "E-mail de verificação enviado com sucesso!",
        });
    }
    catch (error) {
        console.error("Erro ao reenviar verificação:", error);
        // A tentativa não chegou ao destinatário; permita tentar novamente.
        const identificador = req.body.login ?? req.body.email ?? req.body.username;
        if (typeof identificador === "string") {
            await prismaClient_1.default.usuario.updateMany({
                where: {
                    OR: [
                        { email: identificador.trim().toLowerCase() },
                        { username: identificador.trim().toLowerCase() },
                    ],
                    emailVerificado: false,
                },
                data: { ultimoEmailVerificacaoEnviadoEm: null },
            });
        }
        return res.status(500).json({
            error: "Não foi possível reenviar o e-mail de verificação.",
        });
    }
});
// LOGAR USUÁRIO
// Envia um link de uso único para o e-mail cadastrado.
router.post("/usuarios/recuperar-senha", async (req, res) => {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email)
        return res.status(400).json({ error: "Informe seu e-mail." });
    try {
        const usuario = await prismaClient_1.default.usuario.findUnique({ where: { email } });
        if (!usuario) {
            return res.status(404).json({ error: "Este e-mail não está cadastrado." });
        }
        const token = (0, crypto_1.randomBytes)(32).toString("hex");
        const tokenHash = (0, crypto_1.createHash)("sha256").update(token).digest("hex");
        await prismaClient_1.default.usuario.update({
            where: { id: usuario.id },
            data: { tokenRedefinicaoSenhaHash: tokenHash, tokenRedefinicaoSenhaExpiraEm: new Date(Date.now() + 60 * 60 * 1000) },
        });
        try {
            await (0, emailService_1.enviarEmailRedefinicaoSenha)({ email: usuario.email, token });
        }
        catch (erro) {
            console.error("Falha no envio de e-mail de redefinição:", erro);
            await prismaClient_1.default.usuario.update({ where: { id: usuario.id }, data: { tokenRedefinicaoSenhaHash: null, tokenRedefinicaoSenhaExpiraEm: null } });
            return res.status(502).json({ error: "Não foi possível enviar o link agora. Tente novamente mais tarde." });
        }
        return res.status(200).json({ message: "Link de redefinição enviado para o e-mail cadastrado." });
    }
    catch (erro) {
        console.error("Erro ao solicitar redefinição de senha:", erro);
        return res.status(500).json({ error: "Não foi possível solicitar o link de redefinição." });
    }
});
router.post("/usuarios/redefinir-senha", async (req, res) => {
    try {
        const { token, senha } = req.body;
        if (typeof token !== "string" || !token || typeof senha !== "string") {
            return res.status(400).json({ error: "Link inválido ou senha não informada." });
        }
        if (senha.length < 8 || senha.length > 128 || !/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || !/[0-9]/.test(senha) || !/[^a-zA-Z0-9]/.test(senha)) {
            return res.status(400).json({ error: "A senha deve ter 8 a 128 caracteres e incluir maiúscula, minúscula, número e símbolo." });
        }
        const tokenHash = (0, crypto_1.createHash)("sha256").update(token).digest("hex");
        const usuario = await prismaClient_1.default.usuario.findUnique({ where: { tokenRedefinicaoSenhaHash: tokenHash } });
        if (!usuario || !usuario.tokenRedefinicaoSenhaExpiraEm || usuario.tokenRedefinicaoSenhaExpiraEm <= new Date()) {
            return res.status(400).json({ error: "Este link expirou ou já foi utilizado. Solicite outro e-mail." });
        }
        await prismaClient_1.default.usuario.update({
            where: { id: usuario.id },
            data: {
                senhaHash: await bcryptjs_1.default.hash(senha, 10),
                tokenRedefinicaoSenhaHash: null,
                tokenRedefinicaoSenhaExpiraEm: null,
            },
        });
        return res.json({ message: "Senha redefinida. Você já pode entrar com a nova senha." });
    }
    catch (erro) {
        console.error("Erro ao redefinir senha:", erro);
        return res.status(500).json({ error: "Não foi possível redefinir a senha." });
    }
});
router.post("/login", async (req, res) => {
    try {
        const { login, senha } = req.body;
        if (typeof login !== "string" ||
            typeof senha !== "string" ||
            !login.trim() ||
            !senha) {
            return res.status(400).json({
                error: "Informe seu e-mail ou usuário, e senha.",
            });
        }
        const loginNormalizado = login.trim().toLowerCase();
        const usuario = await prismaClient_1.default.usuario.findFirst({
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
        const senhaValida = await bcryptjs_1.default.compare(senha, usuario.senhaHash);
        if (!senhaValida) {
            return res.status(401).json({
                error: "Username, email ou senha incorretos.",
            });
        }
        if (!usuario.emailVerificado) {
            return res.status(403).json({
                error: "EMAIL_NAO_VERIFICADO",
                message: "Você precisa confirmar seu e-mail antes de entrar.",
            });
        }
        const token = jsonwebtoken_1.default.sign({
            usuarioId: usuario.id,
        }, process.env.JWT_SECRET, {
            // O app mantém a sessão no armazenamento local persistente; o prazo longo evita
            // desconectar o usuário diariamente. A sessão web conserva o prazo curto.
            expiresIn: req.body?.cliente === "mobile" ? "90d" : "8h",
        });
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
    }
    catch (error) {
        console.error("Erro ao fazer login:", error);
        return res.status(500).json({
            error: "Erro interno",
        });
    }
});
// LISTAR USUÁRIOS
router.get("/usuarios", async (req, res) => {
    try {
        const busca = typeof req.query.search === "string" ? req.query.search.trim() : "";
        const usuarios = await prismaClient_1.default.usuario.findMany({
            where: busca
                ? {
                    OR: [
                        { username: { contains: busca, mode: "insensitive" } },
                        { nome: { contains: busca, mode: "insensitive" } },
                    ],
                }
                : undefined,
            take: busca ? 8 : undefined,
            orderBy: { username: "asc" },
            select: {
                id: true,
                nome: true,
                username: true,
                foto: true,
            },
        });
        return res.status(200).json(usuarios);
    }
    catch (error) {
        console.error("Erro ao buscar usuários", error);
        return res.status(500).json({
            error: "Erro interno",
        });
    }
});
// Estatísticas agregadas do universo musical pessoal; não envia o histórico inteiro ao app.
router.get("/usuarios/me/universo", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const filtroPosts = { usuarioId };
        const [totalAvaliacoes, media, distribuicao, generos, artistas, totalSalvas, trajetoria] = await Promise.all([
            prismaClient_1.default.post.count({ where: filtroPosts }),
            prismaClient_1.default.post.aggregate({
                where: filtroPosts,
                _avg: { nota: true },
            }),
            prismaClient_1.default.post.groupBy({
                by: ["nota"],
                where: filtroPosts,
                _count: { _all: true },
                orderBy: { nota: "asc" },
            }),
            prismaClient_1.default.musica.groupBy({
                by: ["genero"],
                where: { posts: { some: filtroPosts } },
                _count: { _all: true },
                orderBy: { _count: { id: "desc" } },
            }),
            prismaClient_1.default.musica.groupBy({
                by: ["artistaId"],
                where: { posts: { some: filtroPosts } },
                _count: { _all: true },
                orderBy: { _count: { id: "desc" } },
                take: 5,
            }),
            prismaClient_1.default.salvamento.count({ where: { usuarioId } }),
            prismaClient_1.default.$queryRaw `
            SELECT
              TO_CHAR(DATE_TRUNC('month', "dataCriacao"), 'YYYY-MM-DD') AS mes,
              COUNT(*)::integer AS quantidade
            FROM "Post"
            WHERE "usuarioId" = ${usuarioId}
              AND "dataCriacao" >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
            GROUP BY DATE_TRUNC('month', "dataCriacao")
            ORDER BY DATE_TRUNC('month', "dataCriacao") ASC
          `,
        ]);
        const dadosArtistas = await prismaClient_1.default.artista.findMany({
            where: { id: { in: artistas.map((item) => item.artistaId) } },
            select: { id: true, nome: true, fotoURL: true },
        });
        const contagemPorArtista = new Map(artistas.map((item) => [item.artistaId, item._count._all]));
        return res.status(200).json({
            totalAvaliacoes,
            totalMusicasSalvas: totalSalvas,
            totalGeneros: generos.length,
            mediaGeral: Number((media._avg.nota ?? 0).toFixed(1)),
            distribuicao: distribuicao.map((item) => ({
                nota: item.nota,
                quantidade: item._count._all,
            })),
            generos: generos.slice(0, 5).map((item) => ({
                nome: item.genero,
                quantidade: item._count._all,
            })),
            artistas: dadosArtistas
                .map((artista) => ({
                ...artista,
                quantidade: contagemPorArtista.get(artista.id) ?? 0,
            }))
                .sort((a, b) => b.quantidade - a.quantidade),
            trajetoria,
        });
    }
    catch (error) {
        console.error("Erro ao buscar universo musical:", error);
        return res.status(500).json({ error: "Não foi possível carregar seu universo musical." });
    }
});
// BUSCAR PERFIL PÚBLICO PELO USERNAME
router.get("/usuarios/publico/:username", authMiddleware_1.optionalAuthMiddleware, async (req, res) => {
    try {
        const username = String(req.params.username);
        const usuarioLogadoId = req.usuarioId;
        const usuario = await prismaClient_1.default.usuario.findUnique({
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
            ? !!(await prismaClient_1.default.seguidor.findUnique({
                where: {
                    seguidorId_seguidoId: {
                        seguidorId: usuarioLogadoId,
                        seguidoId: usuario.id,
                    },
                },
            }))
            : false;
        const segueDeVolta = usuarioLogadoId
            ? !!(await prismaClient_1.default.seguidor.findUnique({
                where: {
                    seguidorId_seguidoId: {
                        seguidorId: usuario.id,
                        seguidoId: usuarioLogadoId,
                    },
                },
                select: { seguidorId: true },
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
            segueDeVolta,
        });
    }
    catch (error) {
        console.error("Erro ao buscar perfil público:", error);
        return res.status(500).json({
            error: "Erro interno",
        });
    }
});
// BUSCAR MEU PERFIL
router.get("/usuarios/me/notificacoes/preferencias", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuario = await prismaClient_1.default.usuario.findUnique({
            where: { id: req.usuarioId },
            select: {
                notificacoesCurtidas: true,
                notificacoesComentarios: true,
                notificacoesSeguidores: true,
            },
        });
        if (!usuario)
            return res.status(404).json({ error: "Usuário não encontrado" });
        return res.json({
            curtidas: usuario.notificacoesCurtidas,
            comentarios: usuario.notificacoesComentarios,
            seguidores: usuario.notificacoesSeguidores,
        });
    }
    catch (error) {
        console.error("Erro ao carregar preferências de notificação:", error);
        return res.status(500).json({ error: "Não foi possível carregar as preferências." });
    }
});
router.put("/usuarios/me/notificacoes/preferencias", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const { curtidas, comentarios, seguidores } = req.body;
        if ([curtidas, comentarios, seguidores].some((valor) => typeof valor !== "boolean")) {
            return res.status(400).json({ error: "Informe valores booleanos para cada preferência." });
        }
        await prismaClient_1.default.usuario.update({
            where: { id: req.usuarioId },
            data: {
                notificacoesCurtidas: curtidas,
                notificacoesComentarios: comentarios,
                notificacoesSeguidores: seguidores,
            },
        });
        return res.json({ curtidas, comentarios, seguidores });
    }
    catch (error) {
        console.error("Erro ao salvar preferências de notificação:", error);
        return res.status(500).json({ error: "Não foi possível salvar as preferências." });
    }
});
router.get("/usuarios/me", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const usuario = await prismaClient_1.default.usuario.findUnique({
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
    }
    catch (error) {
        console.error("Erro ao buscar perfil", error);
        return res.status(500).json({
            error: "Erro interno",
        });
    }
});
// EXCLUIR MINHA CONTA
router.delete("/usuarios/me", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        await prismaClient_1.default.$transaction([
            // Apaga notificações recebidas por outras pessoas que foram geradas por este usuário.
            prismaClient_1.default.notificacao.deleteMany({ where: { atorId: usuarioId } }),
            prismaClient_1.default.usuario.delete({ where: { id: usuarioId } }),
        ]);
        return res.status(200).json({
            message: "Conta excluída com sucesso.",
        });
    }
    catch (error) {
        console.error("Erro ao excluir conta:", error);
        return res.status(500).json({
            error: "Não foi possível excluir sua conta.",
        });
    }
});
// EDITAR MEU PERFIL
router.put("/usuarios/me", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const { nome, username, bio, foto, capa } = req.body;
        if (username !== undefined && !username.trim()) {
            return res.status(400).json({
                error: "O username não pode ficar vazio",
            });
        }
        // Verifica se o novo username já pertence a outra pessoa
        if (username !== undefined) {
            const usernameExistente = await prismaClient_1.default.usuario.findFirst({
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
        const usuario = await prismaClient_1.default.usuario.update({
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
    }
    catch (error) {
        console.error("Erro ao editar perfil", error);
        return res.status(500).json({
            error: "Erro interno",
        });
    }
});
// BUSCAR POSTS CURTIDOS PELO USUÁRIO LOGADO
router.get("/usuarios/me/curtidas", authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const posts = await prismaClient_1.default.post.findMany({
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
        return res.status(200).json(posts.map((post) => ({
            ...post,
            curtidoPorMim: true,
        })));
    }
    catch (error) {
        console.error("Erro ao buscar posts curtidos:", error);
        return res.status(500).json({
            error: "Não foi possível buscar os posts curtidos.",
        });
    }
});
exports.default = router;
