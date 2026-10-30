
import express from "express";
import "dotenv/config";
import cors from "cors";

import musicaRoutes from "./routes/musicaRoutes";
import usuarioRoutes from "./routes/usuarioRoutes";
import postRoutes from "./routes/postRoutes";
import curtidaRoutes from "./routes/curtidaRoutes";
import comentarioRoutes from "./routes/comentarioRoutes";
import seguidorRoutes from "./routes/seguidorRoutes";
import salvamentoRoutes from "./routes/salvamentoRoutes";
import artistaRoutes from "./routes/artistaRoutes";
import usuarioGeneroRoutes from "./routes/usuarioGeneroRoutes";
import usuarioArtistaRoutes from "./routes/usuárioArtistaRoutes";
import musicasRecomendadasRoutes from "./routes/musicasRecomendadasRoutes";
import notificacaoRoutes from "./routes/notificacaoRoutes";

const app = express();

app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(express.json());

app.use("/", musicaRoutes);
app.use("/", usuarioRoutes);
app.use("/", postRoutes);
app.use("/", curtidaRoutes);
app.use("/", comentarioRoutes);
app.use("/", seguidorRoutes);
app.use("/", salvamentoRoutes);
app.use("/", artistaRoutes);
app.use("/", usuarioArtistaRoutes);
app.use("/", usuarioGeneroRoutes);
app.use("/", musicasRecomendadasRoutes);
app.use("/", notificacaoRoutes);

const PORT = process.env.PORT || 3000;

app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
