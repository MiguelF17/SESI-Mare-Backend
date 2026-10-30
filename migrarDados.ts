
import "dotenv/config";
import Database from "better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não foi encontrada no .env");
}

const sqlite = new Database("./dev.db", {
    readonly: true,
});

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

// Converte os booleanos e as datas do SQLite.
function prepararRegistro(
    registro: any,
    camposData: string[] = [],
    camposBooleanos: string[] = []
) {
    const resultado = { ...registro };

    for (const campo of camposBooleanos) {
        resultado[campo] = Boolean(resultado[campo]);
    }

    for (const campo of camposData) {
        if (resultado[campo] !== null && resultado[campo] !== undefined) {
            resultado[campo] = new Date(resultado[campo]);
        }
    }

    return resultado;
}

async function migrarDados() {
    console.log("Iniciando transferência dos dados...");

    try {
        const tabelas = [
            "Usuario",
            "Artista",
            "Musica",
            "Post",
            "Curtida",
            "Comentario",
            "Seguidor",
            "Salvamento",
            "UsuarioArtista",
            "UsuarioGenero",
            "Notificacao",
        ];

        // Confere os registros existentes no SQLite.
        for (const tabela of tabelas) {
            const resultado = sqlite
                .prepare(`SELECT COUNT(*) as total FROM "${tabela}"`)
                .get() as { total: number };

            console.log(`${tabela}: ${resultado.total} registros`);
        }

        // Lê todos os dados do banco antigo.
        const usuarios = sqlite.prepare('SELECT * FROM "Usuario"').all() as any[];
        const artistas = sqlite.prepare('SELECT * FROM "Artista"').all() as any[];
        const musicas = sqlite.prepare('SELECT * FROM "Musica"').all() as any[];
        const posts = sqlite.prepare('SELECT * FROM "Post"').all() as any[];
        const curtidas = sqlite.prepare('SELECT * FROM "Curtida"').all() as any[];
        const comentarios = sqlite.prepare('SELECT * FROM "Comentario"').all() as any[];
        const seguidores = sqlite.prepare('SELECT * FROM "Seguidor"').all() as any[];
        const salvamentos = sqlite.prepare('SELECT * FROM "Salvamento"').all() as any[];
        const usuariosArtistas = sqlite.prepare('SELECT * FROM "UsuarioArtista"').all() as any[];
        const usuariosGeneros = sqlite.prepare('SELECT * FROM "UsuarioGenero"').all() as any[];
        const notificacoes = sqlite.prepare('SELECT * FROM "Notificacao"').all() as any[];

        // Impede duplicar dados caso o banco de destino já tenha registros.
        const totalDestino = await prisma.usuario.count()
            + await prisma.artista.count()
            + await prisma.musica.count()
            + await prisma.post.count()
            + await prisma.curtida.count()
            + await prisma.comentario.count()
            + await prisma.seguidor.count()
            + await prisma.salvamento.count()
            + await prisma.usuarioArtista.count()
            + await prisma.usuarioGenero.count()
            + await prisma.notificacao.count();

        if (totalDestino > 0) {
            throw new Error(
                "O banco PostgreSQL não está vazio. A transferência foi cancelada para evitar duplicações."
            );
        }

        await prisma.$transaction(async (tx) => {
            // Usuários
            await tx.usuario.createMany({
                data: usuarios.map((usuario) =>
                    prepararRegistro(
                        usuario,
                        [
                            "dataCadastro",
                            "tokenVerificacaoExpiraEm",
                            "ultimoEmailVerificacaoEnviadoEm",
                        ],
                        ["emailVerificado", "preferenciasConcluidas"]
                    )
                ),
            });

            // Artistas
            await tx.artista.createMany({
                data: artistas,
            });

            // Músicas
            await tx.musica.createMany({
                data: musicas,
            });

            // Publicações
            await tx.post.createMany({
                data: posts.map((post) =>
                    prepararRegistro(post, ["dataCriacao"])
                ),
            });

            // Curtidas
            await tx.curtida.createMany({
                data: curtidas.map((curtida) =>
                    prepararRegistro(curtida, ["dataCriacao"])
                ),
            });

            // Comentários
            await tx.comentario.createMany({
                data: comentarios.map((comentario) =>
                    prepararRegistro(
                        comentario,
                        ["dataCriacao"],
                        ["editado"]
                    )
                ),
            });

            // Seguidores
            await tx.seguidor.createMany({
                data: seguidores.map((seguidor) =>
                    prepararRegistro(seguidor, ["dataCriacao"])
                ),
            });

            // Músicas salvas
            await tx.salvamento.createMany({
                data: salvamentos.map((salvamento) =>
                    prepararRegistro(salvamento, ["dataCriacao"])
                ),
            });

            // Artistas favoritos
            await tx.usuarioArtista.createMany({
                data: usuariosArtistas,
            });

            // Gêneros favoritos
            await tx.usuarioGenero.createMany({
                data: usuariosGeneros,
            });

            // Notificações
            await tx.notificacao.createMany({
                data: notificacoes.map((notificacao) =>
                    prepararRegistro(
                        notificacao,
                        ["criadaEm"],
                        ["lida"]
                    )
                ),
            });

            // Atualiza as sequências dos IDs automáticos do PostgreSQL.
            const tabelasComId = [
                "Usuario",
                "Artista",
                "Musica",
                "Post",
                "Comentario",
                "Notificacao",
            ];

            for (const tabela of tabelasComId) {
                await tx.$executeRawUnsafe(`
                    SELECT setval(
                        pg_get_serial_sequence('"${tabela}"', 'id'),
                        COALESCE((SELECT MAX(id) FROM "${tabela}"), 1),
                        EXISTS (SELECT 1 FROM "${tabela}")
                    )
                `);
            }
        });

        console.log("Transferência concluída!");

    } catch (erro) {
        console.error("Erro durante a transferência:", erro);

    } finally {
        sqlite.close();
        await prisma.$disconnect();
    }
}

migrarDados();
