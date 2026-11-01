
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface EnviarEmailVerificacao {
  email: string;
  token: string;
}

function obterConfiguracao() {
  const apiKey = process.env.BREVO_API_KEY;
  const emailRemetente = process.env.EMAIL_REMETENTE;

  if (!apiKey || !emailRemetente) {
    throw new Error("Configurações do Brevo não encontradas.");
  }

  return { apiKey, emailRemetente };
}

// Verifica se a API Key está funcionando.
export async function testarEmail() {
  const { apiKey } = obterConfiguracao();

  const response = await fetch("https://api.brevo.com/v3/account", {
    method: "GET",
    headers: {
      "api-key": apiKey,
      "accept": "application/json",
    },
  });

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`Erro ao conectar com Brevo: ${erro}`);
  }

  console.log("Conexão com a API do Brevo estabelecida!");
}

export async function enviarEmailVerificacao({
  email,
  token,
}: EnviarEmailVerificacao) {
  const { apiKey, emailRemetente } = obterConfiguracao();

  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, "");
  const logoUrl = process.env.LOGO_URL;

  if (!frontendUrl) {
    throw new Error("FRONTEND_URL não configurada.");
  }

  if (!logoUrl) {
    throw new Error("LOGO_URL não configurada.");
  }

  const link = `${frontendUrl}/verificar-email?token=${encodeURIComponent(token)}`;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirme seu e-mail - Maré</title>
    </head>

    <body style="
        margin: 0;
        padding: 0;
        background-color: #080A10;
        font-family: Arial, Helvetica, sans-serif;
        color: #E4EFFF;
    ">

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
            style="background-color: #080A10; padding: 40px 16px;">
            <tr>
                <td align="center">

                    <table width="100%" cellpadding="0" cellspacing="0" border="0"
                        style="
                            max-width: 560px;
                            background-color: #111420;
                            border: 1px solid #354052;
                            border-radius: 16px;
                            overflow: hidden;
                        ">

                        <tr>
                            <td style="height: 5px; background-color: #58AAF0;"></td>
                        </tr>

                        <tr>
                            <td align="center" style="padding: 36px 24px 20px;">
                                <img
                                    src="${logoUrl}"
                                    alt="Maré"
                                    width="150"
                                    style="display:block;width:150px;max-width:100%;height:auto;border:0;"
                                >
                            </td>
                        </tr>

                        <tr>
                            <td align="center" style="padding: 12px 36px 36px;">

                                <p style="
                                    margin: 0 0 12px;
                                    color: #58AAF0;
                                    font-size: 12px;
                                    font-weight: bold;
                                    letter-spacing: 2px;
                                    text-transform: uppercase;
                                ">
                                    Bem-vindo à Maré
                                </p>

                                <h1 style="
                                    margin: 0 0 18px;
                                    color: #E4EFFF;
                                    font-size: 27px;
                                    line-height: 1.3;
                                ">
                                    Só falta confirmar seu e-mail!
                                </h1>

                                <p style="
                                    margin: 0 0 28px;
                                    color: #AAB8CB;
                                    font-size: 15px;
                                    line-height: 1.8;
                                ">
                                    Sua conta está quase pronta. Confirme seu endereço
                                    de e-mail para começar a explorar a comunidade
                                    musical da Maré.
                                </p>

                                <table cellpadding="0" cellspacing="0" border="0" align="center">
                                    <tr>
                                        <td align="center" bgcolor="#58AAF0"
                                            style="border-radius: 8px;">
                                            <a href="${link}" target="_blank"
                                                style="
                                                    display: inline-block;
                                                    padding: 15px 32px;
                                                    color: #080A10;
                                                    font-size: 15px;
                                                    font-weight: bold;
                                                    text-decoration: none;
                                                    border-radius: 8px;
                                                ">
                                                Confirmar meu e-mail
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                                <p style="
                                    margin: 30px 0 8px;
                                    color: #718096;
                                    font-size: 12px;
                                    line-height: 1.7;
                                ">
                                    Se o botão não funcionar, copie e cole este endereço
                                    no navegador:
                                </p>

                                <p style="
                                    margin: 0;
                                    font-size: 12px;
                                    line-height: 1.7;
                                    word-break: break-all;
                                ">
                                    <a href="${link}"
                                        style="color: #58AAF0; text-decoration: underline;">
                                        ${link}
                                    </a>
                                </p>

                            </td>
                        </tr>

                        <tr>
                            <td style="
                                padding: 22px 30px;
                                background-color: #0C121D;
                                border-top: 1px solid #354052;
                                text-align: center;
                            ">
                                <p style="
                                    margin: 0 0 8px;
                                    color: #718096;
                                    font-size: 12px;
                                    line-height: 1.6;
                                ">
                                    Se você não criou uma conta na Maré,
                                    pode ignorar esta mensagem.
                                </p>

                                <p style="
                                    margin: 0;
                                    color: #526176;
                                    font-size: 11px;
                                ">
                                    © ${new Date().getFullYear()} Maré.
                                    Todos os direitos reservados.
                                </p>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>

    </body>
    </html>
    `;

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: "Maré",
        email: emailRemetente,
      },
      to: [
        {
          email,
        },
      ],
      subject: "Confirme seu e-mail | Maré",
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const erro = await response.text();

    console.error("Erro ao enviar e-mail pelo Brevo:", erro);

    throw new Error("Não foi possível enviar o e-mail de verificação.");
  }

  const resultado = await response.json() as { messageId: string };

  console.log("E-mail enviado pelo Brevo:", resultado.messageId);

  return resultado;
}
