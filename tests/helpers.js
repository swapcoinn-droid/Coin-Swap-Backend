// Lógica pura extraída del Swap Coin API
// Fábricas de errores (errorHandler.js)

export function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

export const badRequest   = (msg) => createError(msg, 400);
export const notFound     = (msg) => createError(msg, 404);
export const conflict     = (msg) => createError(msg, 409);
export const unauthorized = (msg) => createError(msg, 401);
export const forbidden    = (msg) => createError(msg, 403);

export class ServiceError extends Error {
    constructor(message, statusCode = 503) {
        super(message);
        this.name = "ServiceError";
        this.statusCode = statusCode;
        this.isOperational = true;
    }
}

// Validación de autenticación (middleware/auth.validate.js)

export function validateRegister({ name, email, password } = {}) {
    if (!name || !email || !password)
        return { ok: false, error: "Nombre, email y contraseña son requeridos" };
    if (password.length < 6)
        return { ok: false, error: "La contraseña debe tener al menos 6 caracteres" };
    return { ok: true };
}

export function validateLogin({ email, password } = {}) {
    if (!email || !password)
        return { ok: false, error: "Email y contraseña son requeridos" };
    return { ok: true };
}

// Sanitizadores de monto y paginación (middleware/validate.middleware.js)

export function sanitizeAmount(amount) {
    if (amount === undefined) return { ok: true, value: undefined };
    if (typeof amount !== "number")
        return { ok: false, error: "El monto debe ser un número" };
    if (amount <= 0)
        return { ok: false, error: "El monto debe ser mayor a 0" };
    const decimals = amount.toString().split(".")[1];
    if (decimals && decimals.length > 2)
        return { ok: false, error: "El monto no puede tener más de 2 decimales" };
    return { ok: true, value: +amount.toFixed(2) };
}

export function sanitizePagination(page, limit) {
    page  = parseInt(page);
    limit = parseInt(limit);
    if (isNaN(page)  || page  < 1) return { ok: false, error: "Página inválida" };
    if (isNaN(limit) || limit < 1) return { ok: false, error: "Límite inválido" };
    if (limit > 100)               return { ok: false, error: "El límite máximo es 100" };
    return { ok: true, page, limit };
}

// Conversion de divisas (services/exchangeRateService.js)

export function convertAmount(amount, fromCode, toCode, rates) {
    const fromRate = rates[fromCode];
    const toRate   = rates[toCode];
    const inUSD    = amount / fromRate;
    return +(inUSD * toRate).toFixed(2);
}

export function getAppliedRate(fromCode, toCode, rates) {
    return +(rates[toCode] / rates[fromCode]).toFixed(6);
}

// Validación de wallet (routes/wallet.routes.js)

export function validateDeposit({ amount, currency = "COP" }) {
    if (!amount || amount <= 0) return { ok: false, error: "Monto inválido" };
    return { ok: true, amount, currency };
}

export function validateWithdraw({ amount, currency = "COP" }) {
    if (!amount || amount <= 0) return { ok: false, error: "Monto inválido" };
    return { ok: true, amount, currency };
}

export function validateExchange({ from, to, amount }) {
    if (!from || !to || !amount || amount <= 0)
        return { ok: false, error: "Datos inválidos" };
    if (from === to)
        return { ok: false, error: "Las monedas deben ser diferentes" };
    return { ok: true };
}

export function checkSufficientFunds(balance, amount) {
    if (balance < amount) throw badRequest("Saldo insuficiente");
    return true;
}

// Validación de metas (routes/goals.routes.js)

export function validateCreateGoal({ name, targetAmount, currency = "COP" }) {
    if (!name)                            return { ok: false, error: "El nombre es requerido" };
    if (!targetAmount || targetAmount <= 0) return { ok: false, error: "Monto objetivo inválido" };
    return { ok: true, name, targetAmount, currency };
}

export function validateUpdateGoal({ name, targetAmount, targetDate }) {
    if (!name && !targetAmount && !targetDate)
        return { ok: false, error: "Debes enviar al menos un campo para actualizar" };
    return { ok: true };
}

export function validateGoalContribution(amount, currentAmount, targetAmount) {
    if (!amount || amount <= 0) return { ok: false, error: "Monto inválido" };
    const remaining = targetAmount - currentAmount;
    if (amount > remaining)
        return { ok: false, error: `El monto excede lo necesario, solo faltan ${remaining} para completar la meta` };
    return { ok: true };
}

export function validateGoalWithdraw(amount, currentAmount) {
    if (!amount || amount <= 0) return { ok: false, error: "Monto inválido" };
    if (amount > currentAmount)
        return { ok: false, error: `No puedes retirar más de ${currentAmount} de esta meta` };
    return { ok: true };
}

export function calcProgress(current, target) {
    return +((current / target) * 100).toFixed(2);
}

export function canEditGoal(status) {
    if (status !== "active")
        return { ok: false, error: "No puedes editar una meta que no está activa" };
    return { ok: true };
}

export function newTargetAmountIsValid(newAmount, currentAmount) {
    if (newAmount < currentAmount)
        return { ok: false, error: `El nuevo monto objetivo no puede ser menor al monto ya ahorrado (${currentAmount})` };
    return { ok: true };
}

// Validación de chat (routes/chat.routes.js)

export function validateChatMessage({ message, history = [] }) {
    if (!message || typeof message !== "string" || !message.trim())
        return { ok: false, error: "El mensaje es requerido" };
    if (!Array.isArray(history))
        return { ok: false, error: "El historial debe ser un array" };
    return { ok: true, message: message.trim(), history };
}
