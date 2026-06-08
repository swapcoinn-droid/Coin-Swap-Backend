import { badRequest } from "../error/errorHandler.js";

export function validateRegister(req, res, next) {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
        return next(badRequest("Username, email y contraseña son requeridos"));
    if (password.length < 6)
        return next(badRequest("La contraseña debe tener al menos 6 caracteres"));
    next();
}

export function validateLogin(req, res, next) {
    const { email, password } = req.body;
    if (!email || !password)
        return next(badRequest("Email y contraseña son requeridos"));
    next();
}