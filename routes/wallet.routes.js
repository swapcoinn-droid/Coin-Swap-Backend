import express from "express";
import { getWallet, deposit, withdraw, exchange, getTransactions } from "../services/walletService.js";
import { sanitizeAmount, sanitizePagination } from "../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { badRequest } from "../error/errorHandler.js";

const walletRouter = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

walletRouter.get("/", requireAuth, asyncHandler(async (req, res) => {
    const wallet = await getWallet(req.user.id);
    res.status(200).json(wallet);
}));

walletRouter.post("/deposit", requireAuth, sanitizeAmount, asyncHandler(async (req, res, next) => {
    const { amount, currency = "COP" } = req.body;
    if (!amount || amount <= 0) return next(badRequest("Monto inválido"));
    const result = await deposit({ userId: req.user.id, amount, currencyCode: currency });
    res.status(200).json(result);
}));

walletRouter.post("/withdraw", requireAuth, sanitizeAmount, asyncHandler(async (req, res, next) => {
    const { amount, currency = "COP" } = req.body;
    if (!amount || amount <= 0) return next(badRequest("Monto inválido"));
    const result = await withdraw({ userId: req.user.id, amount, currencyCode: currency });
    res.status(200).json(result);
}));

walletRouter.post("/exchange", requireAuth, sanitizeAmount, asyncHandler(async (req, res, next) => {
    const { from, to, amount } = req.body;
    if (!from || !to || !amount || amount <= 0) return next(badRequest("Datos inválidos"));
    if (from === to) return next(badRequest("Las monedas deben ser diferentes"));
    const result = await exchange({ userId: req.user.id, fromCode: from, toCode: to, amount });
    res.status(200).json(result);
}));

walletRouter.get("/transactions", requireAuth, sanitizePagination, asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const result = await getTransactions(req.user.id, { page: +page, limit: +limit });
    res.status(200).json(result);
}));

export default walletRouter;