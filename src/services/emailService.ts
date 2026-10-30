
/* Serviço de envio de email de verificação — temporariamente desativado.
import nodemailer from "nodemailer";
import path from "path";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

interface EnviarEmailVerificacao {
    email: string;
    token: string;
}

export async function testarEmail() {
    await transporter.verify();
    console.log("Conexão com Gmail SMTP estabelecida!");
}

export async function enviarEmailVerificacao({
    email,
    token,
}: EnviarEmailVerificacao) {
    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, "");

    if (!frontendUrl) {
        throw new Error("FRONTEND_URL não configurada.");
    }

    const link = `${frontendUrl}/verificar-email?token=${encodeURIComponent(token)}`;

    await transporter.sendMail({
        from: `"Maré" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Confirme seu e-mail | Maré",

        attachments: [
            {
                filename: "logo.png",
                path: path.resolve(__dirname, "../../assets/logo.png"),
                cid: "logo-mare",
            },
        ],

        html: `
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

          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="background-color: #080A10; padding: 40px 16px;"
          >
            <tr>
              <td align="center">

                <table
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="
                    max-width: 560px;
                    background-color: #111420;
                    border: 1px solid #354052;
                    border-radius: 16px;
                    overflow: hidden;
                  "
                >

                  <!-- DETALHE SUPERIOR -->
                  <tr>
                    <td style="
                      height: 5px;
                      background-color: #58AAF0;
                      font-size: 0;
                    ">&nbsp;</td>
                  </tr>

                  <!-- LOGO -->
                  <tr>
                    <td align="center" style="padding: 36px 24px 20px;">
                    <img
  src="cid:logo-mare"
  alt="Maré"
  width="150"
  style="
    display: block;
    width: 150px;
    max-width: 100%;
    height: auto;
    border: 0;
  "
>
                    </td>
                  </tr>

                  <!-- CONTEÚDO -->
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

                      <!-- BOTÃO -->
                      <table
                        cellpadding="0"
                        cellspacing="0"
                        border="0"
                        align="center"
                      >
                        <tr>
                          <td
                            align="center"
                            bgcolor="#58AAF0"
                            style="border-radius: 8px;"
                          >
                            <a
                              href="${link}"
                              target="_blank"
                              style="
                                display: inline-block;
                                padding: 15px 32px;
                                color: #080A10;
                                font-size: 15px;
                                font-weight: bold;
                                text-decoration: none;
                                border-radius: 8px;
                              "
                            >
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
                        <a
                          href="${link}"
                          style="color: #58AAF0; text-decoration: underline;"
                        >
                          ${link}
                        </a>
                      </p>

                    </td>
                  </tr>

                  <!-- RODAPÉ -->
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
                        © ${new Date().getFullYear()} Maré. Todos os direitos reservados.
                      </p>
                    </td>
                  </tr>

                </table>

              </td>
            </tr>
          </table>

        </body>
      </html>
    `,
    });
}
*/
