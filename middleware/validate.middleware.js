import { badRequest } from "../error/errorHandler.js";

export function sanitizeAmount(req, res, next) {
    const { amount } = req.body;

    if (amount === undefined) return next();

    // Debe ser un número
    if (typeof amount !== "number") {
        return next(badRequest("El monto debe ser un número"));
    }

    // Debe ser positivo
    if (amount <= 0) {
        return next(badRequest("El monto debe ser mayor a 0"));
    }

    // Máximo 2 decimales
    const decimals = amount.toString().split(".")[1];
    if (decimals && decimals.length > 2) {
        return next(badRequest("El monto no puede tener más de 2 decimales"));
    }

    // Redondear a 2 decimales porlas
    req.body.amount = +amount.toFixed(2);

    next();
}

export function sanitizePagination(req, res, next) {
    let { page = 1, limit = 10 } = req.query;

    page  = parseInt(page);
    limit = parseInt(limit);

    if (isNaN(page)  || page  < 1) return next(badRequest("Página inválida"));
    if (isNaN(limit) || limit < 1) return next(badRequest("Límite inválido"));
    if (limit > 100) return next(badRequest("El límite máximo es 100"));

    req.query.page  = page;
    req.query.limit = limit;

    next();
}