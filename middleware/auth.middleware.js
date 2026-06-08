import jwt from "jsonwebtoken";
import { unauthorized } from "../error/errorHandler.js";

export function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return next(unauthorized("Token requerido"));

    try {
        const token = header.split(" ")[1];
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        next(unauthorized("Token inválido o expirado"));
    }
}