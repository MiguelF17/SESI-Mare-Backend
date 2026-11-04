import prisma from "../prismaClient";

type DadosPush = {
  titulo: string;
  corpo: string;
  dados?: Record<string, string | number>;
  imagem?: string | null;
  categoria?: string;
  /** Mantém só o alerta mais recente de um mesmo grupo no aparelho. */
  collapseId?: string;
};

/** Entrega push sem atrasar nem cancelar a ação principal caso o serviço externo falhe. */
export async function enviarPushParaUsuario(usuarioId: number, push: DadosPush) {
  try {
    const registros = await prisma.tokenNotificacaoPush.findMany({
      where: { usuarioId },
      select: { token: true },
    });
    if (registros.length === 0) return;

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
      // Mensagens substituem o alerta anterior da mesma conversa. As demais
      // atividades também são agrupadas por tipo para evitar uma bandeja infinita.
      collapseId: push.collapseId ?? (push.dados?.tipo === "mensagem" && push.dados.conversaId != null
        ? `mare-chat-${push.dados.conversaId}`
        : `mare-atividade-${push.dados?.tipo ?? "geral"}`),
      tag: push.collapseId ?? (push.dados?.tipo === "mensagem" && push.dados.conversaId != null
        ? `mare-chat-${push.dados.conversaId}`
        : `mare-atividade-${push.dados?.tipo ?? "geral"}`),
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
