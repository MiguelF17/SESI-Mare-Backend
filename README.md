<p align="center"><img src="assets/logo.png" alt="Logo da Maré" width="116"></p>

<h1 align="center">API da Maré</h1>

<p align="center"><strong>As regras e os dados por trás da experiência musical.</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-182638?logo=nodedotjs&logoColor=58AAF0" alt="Node.js">
  <img src="https://img.shields.io/badge/Express-182638?logo=express&logoColor=58AAF0" alt="Express">
  <img src="https://img.shields.io/badge/PostgreSQL-182638?logo=postgresql&logoColor=58AAF0" alt="PostgreSQL">
</p>

O backend atende a web e o aplicativo mobile. Ele valida as operações, autentica usuários e grava os dados compartilhados entre as duas interfaces.

## O que passa pela API

Contas, publicações, comentários, músicas, preferências, seguidores, salvamentos, playlists, notificações e conversas privadas. O servidor também escolhe recomendações, prepara estatísticas pessoais e coordena os serviços externos de e-mail, imagem e notificações push.

## Começando

Requer Node.js e um banco PostgreSQL acessível. Instale as dependências com `npm install` e crie um `.env` neste diretório:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/mare
JWT_SECRET=troque-por-uma-chave-longa-e-aleatoria
PORT=3000
FRONTEND_URL=http://localhost:5173
BREVO_API_KEY=
EMAIL_REMETENTE=
LOGO_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Brevo envia os e-mails de conta. Cloudinary guarda as imagens enviadas. `LOGO_URL` aponta para uma imagem pública incluída nos e-mails. Nunca publique o `.env`.

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Para produção, use `npm run build` e `npm start`.

## Mapa do código

| Caminho | Responsabilidade |
| --- | --- |
| `src/server.ts` | Express, CORS e registro das rotas |
| `src/routes` | Endpoints e regras de cada recurso |
| `src/middleware` | Autenticação por JWT |
| `src/services` | E-mails e notificações push |
| `src/cloudinary.ts` | Configuração das imagens |
| `prisma/schema.prisma` | Modelos e relações do banco |
| `prisma/migrations` | Evolução do esquema PostgreSQL |

Express recebe as requisições; Prisma acessa o PostgreSQL; JWT identifica a sessão e bcryptjs verifica as senhas. O serviço de push envia notificações ao Expo.

O arquivo `dev.db` e `prisma/migrations_sqlite_backup` são vestígios de uma versão antiga em SQLite. O esquema ativo usa PostgreSQL. A localização do banco e a hospedagem da API dependem da implantação. Veja o [guia do projeto](../docs/guia-do-projeto.md).

## Para conferir uma alteração

Use `npm run build` para verificar o TypeScript. Testes de integração exigem um PostgreSQL configurado; envios de e-mail, imagem e push exigem as credenciais dos respectivos serviços.
