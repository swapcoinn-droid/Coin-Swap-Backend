import rateLimit from "express-rate-limit";

// Limite general para todas las rutas
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100,                  // 100 peticiones por ventana
    message: { error: "Demasiadas peticiones, intenta de nuevo en 15 minutos", status: 429 },
    standardHeaders: true,
    legacyHeaders: false
});

// Limite más estricto para rutas de autenticación
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10,                   // solo 10 intentos de login/register
    message: { error: "Demasiados intentos, intenta de nuevo en 15 minutos", status: 429 },
    standardHeaders: true,
    legacyHeaders: false
});

// Límite más estricto para el exchange que golpea la API externa
export const exchangeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 10,             // 10 conversiones por minuto
    message: { error: "Demasiadas conversiones, intenta de nuevo en 1 minuto", status: 429 },
    standardHeaders: true,
    legacyHeaders: false
});