import express from "express"
import musicaRoutes from "./routes/musicaRoutes"
import usuarioRoutes from "./routes/usuarioRoutes"
import postRoutes from "./routes/postRoutes"
import curtidaRoutes from "./routes/curtidaRoutes"
import comentarioRoutes from "./routes/comentarioRoutes"
import seguidorRoutes from "./routes/seguidorRoutes"
import salvamentoRoutes from "./routes/salvamentoRoutes"
import artistaRoutes from "./routes/artistaRoutes"
import "dotenv/config";


const app = express()

app.use(express.json())
app.use("/api", musicaRoutes)
app.use("/api", usuarioRoutes)
app.use("/api", postRoutes)
app.use("/api", curtidaRoutes)
app.use("/api", comentarioRoutes)
app.use("/api", seguidorRoutes)
app.use("/api", salvamentoRoutes)
app.use("/api", artistaRoutes)


app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000")
})