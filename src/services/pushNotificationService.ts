import prisma from "../prismaClient";

type DadosPush = {
  titulo: string;
  corpo: string;
  dados?: Record<string, string | number>;
};

/** Entrega push sem atrasar nem cancelar a ação principal caso o serviço externo falhe. */
export async function enviarPushParaUsuario(usuarioId: number, push: DadosPush) {
  try {
    const registros = await prisma.tokenNotificacaoPush.findMany({
      where: { usuarioId },
      select: { token: true },
    });
    if (registros.length === 0) return;

    const mensagens = registros.map(({ token }) => ({
      to: token,
      title: push.titulo,
      body: push.corpo,
      data: push.dados ?? {},
      channelId: "mare-atividade",
      priority: "high",
      sound: "default",
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

      const resultado = await resposta.json() as {
        data?: { status?: string; details?: { error?: string } }[];
      };
      const tokensInvalidos = resultado.data
        ?.map((ticket, indice) => ticket.details?.error === "DeviceNotRegistered" ? lote[indice]?.to : null)
        .filter((token): token is string => Boolean(token));

      if (tokensInvalidos?.length) {
        await prisma.tokenNotificacaoPush.deleteMany({ where: { token: { in: tokensInvalidos } } });
      }
    }
  } catch (erro) {
    console.error("Falha ao enviar notificação push:", erro);
  }
}
