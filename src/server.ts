import express from "express";
import musicaRoutes from "./routes/musicaRoutes";
import usuarioRoutes from "./routes/usuarioRoutes";
import postRoutes from "./routes/postRoutes";
import curtidaRoutes from "./routes/curtidaRoutes";
import comentarioRoutes from "./routes/comentarioRoutes";
import seguidorRoutes from "./routes/seguidorRoutes";
import salvamentoRoutes from "./routes/salvamentoRoutes";
import artistaRoutes from "./routes/artistaRoutes";
import usuarioGeneroRoutes from "./routes/usuarioGeneroRoutes"
import usuarioArtistaRoutes from "./routes/usuárioArtistaRoutes"
import "dotenv/config";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
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
app.use("/", usuarioArtistaRoutes)
app.use("/", usuarioGeneroRoutes)

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
