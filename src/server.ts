import express from "express"
import musicaRoutes from "./routes/musicaRoutes"

const app = express()

app.use(express.json())
app.use("/api", musicaRoutes)

app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000")
})