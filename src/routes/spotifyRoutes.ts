import { Router, Request, Response } from "express";

const router = Router();

// Essa função conversa com o Spotify e pede um token.
// O token será usado depois para fazer pesquisas.
async function pegarTokenSpotify() {
	const clientId = process.env.SPOTIFY_CLIENT_ID;
	const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

	// Faz uma requisição para o Spotify pedindo um token
	const resposta = await fetch("https://accounts.spotify.com/api/token", {
		// Informa ao Spotify o formato dos dados enviados
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization:
				"Basic " +
				Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
		},
		body: "grant_type=client_credentials",
	});

	// Transforma a resposta do Spotify em um objeto JSON
	// O "any" está sendo usado porque o TypeScript não sabe
	// automaticamente qual será o formato dessa resposta.
	const dados: any = await resposta.json();

	if (!resposta.ok) {
		throw new Error("Não foi possível pegar o token do Spotify");
	}

	return dados.access_token;
}

router.get("/spotify/buscar", async (req: Request, res: Response) => {
	try {
		// Pega o texto que o usuário colocou na pesquisa.
		const search = req.query.search as string;

		if (!search) {
			return res.status(400).json({
				error: "Informe o nome da música ou artista",
			});
		}

		// Primeiro precisamos pegar um token do Spotify
		const token = await pegarTokenSpotify();

		// Agora fazemos a pesquisa no Spotify
		const resposta = await fetch(
			`https://api.spotify.com/v1/search?q=${encodeURIComponent(search)}&type=track&limit=10`,
			{
				// Envia o token para o Spotify provar
				// que nossa aplicação está autorizada
				headers: {
					Authorization: `Bearer ${token}`,
				},
			},
		);

		const texto = await resposta.text();

		console.log("Resposta do Spotify:", texto);

		return res.status(resposta.status).send(texto);
	} catch (error) {
		console.error("Erro ao buscar músicas no Spotify", error);

		return res.status(500).json({
			error: "Erro ao buscar músicas no Spotify",
		});
	}
});

export default router;
