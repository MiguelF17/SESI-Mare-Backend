"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enviarPushParaUsuario = enviarPushParaUsuario;
const prismaClient_1 = __importDefault(require("../prismaClient"));
/** Entrega push sem atrasar nem cancelar a ação principal caso o serviço externo falhe. */
async function enviarPushParaUsuario(usuarioId, push) {
    try {
        const registros = await prismaClient_1.default.tokenNotificacaoPush.findMany({
            where: { usuarioId },
            select: { token: true },
        });
        if (registros.length === 0)
            return;
        // Mantém o texto da mensagem no push sem ultrapassar o limite do payload do Expo/Android.
        const caracteresCorpo = Array.from(push.corpo);
        const corpo = caracteresCorpo.length > 350
            ? `${caracteresCorpo.slice(0, 347).join("")}...`
            : push.corpo;
        const mensagens = registros.map(({ token }) => ({
            to: token,
            title: push.titulo,
            body: corpo,
            data: push.dados ?? {},
            channelId: "mare-atividade",
            priority: "high",
            sound: "default",
            ...(push.imagem ? { richContent: { image: push.imagem } } : {}),
            ...(push.categoria ? { categoryId: push.categoria } : {}),
        }));
        for (let inicio = 0; inicio < mensagens.length; inicio += 100) {
            const lote = mensagens.slice(inicio, inicio + 100);
            const resposta = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(lote),
            });
            if (!resposta.ok) {
                console.error("O serviço de push recusou o envio:", resposta.status);
                continue;
            }
            const resultado = await resposta.json();
            const tokensInvalidos = resultado.data
                ?.map((ticket, indice) => ticket.details?.error === "DeviceNotRegistered" ? lote[indice]?.to : null)
                .filter((token) => Boolean(token));
            if (tokensInvalidos?.length) {
                await prismaClient_1.default.tokenNotificacaoPush.deleteMany({ where: { token: { in: tokensInvalidos } } });
            }
        }
    }
    catch (erro) {
        console.error("Falha ao enviar notificação push:", erro);
    }
}
