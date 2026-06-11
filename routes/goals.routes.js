import express from "express";
import { getGoals, createGoal, contributeToGoal, withdrawFromGoal, deleteGoal } from "../services/goalsService.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { badRequest } from "../error/errorHandler.js";

const goalsRouter = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

goalsRouter.get("/", requireAuth, asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const result = await getGoals(req.user.id, { page: +page, limit: +limit });
    res.status(200).json(result);
}));

goalsRouter.post("/", requireAuth, asyncHandler(async (req, res, next) => {
    const { name, targetAmount, currency = "COP", targetDate } = req.body;
    if (!name) return next(badRequest("El nombre es requerido"));
    if (!targetAmount || targetAmount <= 0) return next(badRequest("Monto objetivo inválido"));
    const result = await createGoal({
        userId: req.user.id,
        name,
        targetAmount,
        currencyCode: currency,
        targetDate
    });
    res.status(201).json(result);
}));

goalsRouter.post("/:id/contribute", requireAuth, asyncHandler(async (req, res, next) => {
    const { amount } = req.body;
    const goalId = parseInt(req.params.id);
    if (!amount || amount <= 0) return next(badRequest("Monto inválido"));
    if (isNaN(goalId)) return next(badRequest("ID de meta inválido"));
    const result = await contributeToGoal({ userId: req.user.id, goalId, amount });
    res.status(200).json(result);
}));

goalsRouter.post("/:id/withdraw", requireAuth, asyncHandler(async (req, res, next) => {
    const { amount } = req.body;
    const goalId = parseInt(req.params.id);
    if (!amount || amount <= 0) return next(badRequest("Monto inválido"));
    if (isNaN(goalId)) return next(badRequest("ID de meta inválido"));
    const result = await withdrawFromGoal({ userId: req.user.id, goalId, amount });
    res.status(200).json(result);
}));

goalsRouter.delete("/:id", requireAuth, asyncHandler(async (req, res, next) => {
    const goalId = parseInt(req.params.id);
    if (isNaN(goalId)) return next(badRequest("ID de meta inválido"));
    const result = await deleteGoal({ userId: req.user.id, goalId });
    res.status(200).json(result);
}));

export default goalsRouter;