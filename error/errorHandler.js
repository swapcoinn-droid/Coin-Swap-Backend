export function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

export const badRequest = (msg) => createError(msg, 400);
export const notFound = (msg) => createError(msg, 404);
export const conflict = (msg) => createError(msg, 409);
export const unauthorized = (msg) => createError(msg, 401);
export const forbidden = (msg) => createError(msg, 403);
export const internalError = (msg = "Error interno del servidor") => createError(msg, 500);

// Error personalizado para Gemini
export class ServiceError extends Error {
    constructor(message, statusCode = 503) {
        super(message);
        this.name = "ServiceError";
        this.statusCode = statusCode;
        this.isOperational = true;
    }
}

export function errorHandler(err, req, res, next) {
    let statusCode = err.statusCode || err.status || 500;
    let message = err.message || "Error interno del servidor";

    if (!err.statusCode && err.code) {
        if (err.code === "23505") {
            statusCode = 409;
            message = "Ya existe un usuario con ese email";
        } else if (err.code === "23503") {
            statusCode = 404;
            message = "Referencia no encontrada";
        }
    }

    console.error("X Error capturado:", {
        status: statusCode,
        message,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
    });

    const response = { error: message, status: statusCode };

    if (process.env.NODE_ENV === "development") {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
}