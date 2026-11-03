"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const musicaRoutes_1 = __importDefault(require("./routes/musicaRoutes"));
const usuarioRoutes_1 = __importDefault(require("./routes/usuarioRoutes"));
const postRoutes_1 = __importDefault(require("./routes/postRoutes"));
const curtidaRoutes_1 = __importDefault(require("./routes/curtidaRoutes"));
const comentarioRoutes_1 = __importDefault(require("./routes/comentarioRoutes"));
const seguidorRoutes_1 = __importDefault(require("./routes/seguidorRoutes"));
const salvamentoRoutes_1 = __importDefault(require("./routes/salvamentoRoutes"));
const artistaRoutes_1 = __importDefault(require("./routes/artistaRoutes"));
const usuarioGeneroRoutes_1 = __importDefault(require("./routes/usuarioGeneroRoutes"));
const usu__rioArtistaRoutes_1 = __importDefault(require("./routes/usu\u00E1rioArtistaRoutes"));
const musicasRecomendadasRoutes_1 = __importDefault(require("./routes/musicasRecomendadasRoutes"));
const notificacaoRoutes_1 = __importDefault(require("./routes/notificacaoRoutes"));
const conversaRoutes_1 = __importDefault(require("./routes/conversaRoutes"));
const playlistRoutes_1 = __importDefault(require("./routes/playlistRoutes"));
const app = (0, express_1.default)();
const origensPermitidas = [
    "https://mare-amber.vercel.app",
    "https://mare-git-miguel-miguelfrancellino1705-3124.vercel.app",
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || origensPermitidas.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("Origem não permitida pelo CORS"));
        }
    },
    credentials: true,
}));
app.use(express_1.default.json());
// A rota específica de recomendações deve vir antes de /musicas/:id.
app.use("/", musicasRecomendadasRoutes_1.default);
app.use("/", musicaRoutes_1.default);
app.use("/", usuarioRoutes_1.default);
app.use("/", postRoutes_1.default);
app.use("/", curtidaRoutes_1.default);
app.use("/", comentarioRoutes_1.default);
app.use("/", seguidorRoutes_1.default);
app.use("/", salvamentoRoutes_1.default);
app.use("/", artistaRoutes_1.default);
app.use("/", usu__rioArtistaRoutes_1.default);
app.use("/", usuarioGeneroRoutes_1.default);
app.use("/", notificacaoRoutes_1.default);
app.use("/", conversaRoutes_1.default);
app.use("/", playlistRoutes_1.default);
const PORT = process.env.PORT || 3000;
app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
