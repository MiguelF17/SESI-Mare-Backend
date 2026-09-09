import express from "express"
import musicaRoutes from "./routes/musicaRoutes"
import usuarioRoutes from "./routes/usuarioRoutes"
import postRoutes from "./routes/postRoutes"
import "dotenv/config";

const app = express()

app.use(express.json())
app.use("/api", musicaRoutes)
app.use("/api", usuarioRoutes)
app.use("/api", postRoutes)


app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000")
})