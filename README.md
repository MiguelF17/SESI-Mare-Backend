# 🌊 Maré — Backend

**A API responsável por conectar pessoas através da música.**

O Maré é uma plataforma social desenvolvida como Trabalho de Conclusão de Curso (TCC), com o objetivo de proporcionar um espaço onde usuários possam compartilhar suas experiências musicais, avaliar músicas, publicar opiniões e descobrir novos artistas.

Este repositório contém o backend da aplicação, responsável pelo gerenciamento de dados, autenticação, regras de negócio e comunicação com os clientes web e mobile.

## 🛠️ Tecnologias

- **Node.js** — Ambiente de execução.
- **Express** — Framework para construção da API.
- **TypeScript** — Tipagem estática.
- **Prisma ORM** — Comunicação provisória com o banco de dados.
- **SQLite** — Banco de dados provisório.
- **Supabase** — Banco de dados.
- **Render** — Comunicação com o banco de dados
- **JWT** — Autenticação e gerenciamento de sessões.
- **Bcrypt** — Criptografia de senhas.
- **Cloudinary** — Armazenamento de imagens.
- **Multer** — Processamento de uploads.
- **Brevo** — Envio de e-mails.

## ✨ Funcionalidades

- Cadastro e autenticação de usuários.
- Verificação de e-mail.
- Gerenciamento de perfis.
- Upload de fotos de perfil e capas.
- Criação, edição e exclusão de publicações.
- Avaliações musicais com notas de 1 a 5, incluindo intervalos de 0,5.
- Curtidas e comentários.
- Sistema de seguidores.
- Salvamento de músicas.
- Recomendações musicais.
- Pesquisa de usuários, músicas e publicações.
- Sistema de notificações.
- Denúncias de publicações.

## 📁 Estrutura do projeto

```text
backend/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── server.ts
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

*A estrutura pode variar conforme a organização atual do projeto.*

## ⚙️ Como executar

### 1. Clone o repositório

```bash
git clone URL_DO_REPOSITORIO
cd nome-do-repositorio
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
DATABASE_URL="file:./dev.db"

JWT_SECRET="sua_chave_secreta"

PORT=3000

FRONTEND_URL="http://localhost:5173"

CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

BREVO_API_KEY=""
EMAIL_FROM=""
```

Preencha as credenciais necessárias para os serviços utilizados.

### 4. Configure o banco de dados

```bash
npx prisma generate
npx prisma db push
```

### 5. Inicie o servidor

```bash
npm run dev
```

A API estará disponível no endereço configurado na variável `PORT`.

## 🔗 Integração

O backend funciona como camada central de comunicação entre:

- **Maré Web:** interface acessada pelo navegador.
- **Maré Mobile:** aplicação desenvolvida com React Native e Expo.

Ambos consomem os endpoints da API para acessar os mesmos dados e funcionalidades.

## 🔒 Segurança

O projeto utiliza autenticação JWT, hash de senhas, middlewares de proteção e validações para controlar o acesso aos recursos da aplicação.

**Observação:** nunca compartilhe seu arquivo `.env` ou credenciais de serviços externos.

---

Desenvolvido como parte do projeto acadêmico **Maré — TCC**.