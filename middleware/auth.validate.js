import { badRequest } from "../error/errorHandler.js";

export function validateRegister(req, res, next) {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
        return next(badRequest("Nombre, email y contraseña son requeridos"));
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