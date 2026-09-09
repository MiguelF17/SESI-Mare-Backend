import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

export interface AuthRequest extends Request {
    usuarioId?: number
}

export function authMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers.authorization

    if (!authHeader) {
        return res.status(401).json({
            error: "Token não informado"
        })
    }

    const token = authHeader.split(" ")[1]

    if (!token) {
        return res.status(401).json({
            error: "Token inválido"
        })
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET!
        ) as { usuarioId: number }

        req.usuarioId = decoded.usuarioId

        next()

    } catch (error) {
        return res.status(401).json({
            error: "Token inválido ou expirado"
        })
    }
}