
export interface DadosCadastro {
  username: string;
  email: string;
  senha: string;
  confirmarSenha: string;
}

export interface ErroValidacao {
  campo: string;
  mensagem: string;
}

export function validarCadastro(
  dados: DadosCadastro,
): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  const username = dados.username.trim().toLowerCase();
  const email = dados.email.trim().toLowerCase();
  const senha = dados.senha;
  const confirmarSenha = dados.confirmarSenha;

  if (!username) {
    erros.push({
      campo: "username",
      mensagem: "Informe um nome de usuário.",
    });
  } else if (!/^[a-zA-Z0-9._]{3,20}$/.test(username)) {
    erros.push({
      campo: "username",
      mensagem:
        "O usuário deve ter de 3 a 20 caracteres, usando apenas letras, números, pontos e sublinhados.",
    });
  }

  if (!email) {
    erros.push({
      campo: "email",
      mensagem: "Informe seu e-mail.",
    });
  } else if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    erros.push({
      campo: "email",
      mensagem: "Informe um e-mail válido.",
    });
  }

  if (!senha) {
    erros.push({
      campo: "senha",
      mensagem: "Informe uma senha.",
    });
  } else {
    if (senha.length < 8 || senha.length > 128) {
      erros.push({
        campo: "senha",
        mensagem: "A senha deve ter entre 8 e 128 caracteres.",
      });
    }

    if (!/[a-z]/.test(senha)) {
      erros.push({
        campo: "senha",
        mensagem: "A senha deve conter uma letra minúscula.",
      });
    }

    if (!/[A-Z]/.test(senha)) {
      erros.push({
        campo: "senha",
        mensagem: "A senha deve conter uma letra maiúscula.",
      });
    }

    if (!/[0-9]/.test(senha)) {
      erros.push({
        campo: "senha",
        mensagem: "A senha deve conter um número.",
      });
    }

    if (!/[^a-zA-Z0-9]/.test(senha)) {
      erros.push({
        campo: "senha",
        mensagem: "A senha deve conter um símbolo.",
      });
    }
  }

  if (!confirmarSenha) {
    erros.push({
      campo: "confirmarSenha",
      mensagem: "Confirme sua senha.",
    });
  } else if (senha !== confirmarSenha) {
    erros.push({
      campo: "confirmarSenha",
      mensagem: "As senhas não coincidem.",
    });
  }

  return erros;
}
