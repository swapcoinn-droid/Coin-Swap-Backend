import express from "express";
import { chat } from "../services/chatService.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { badRequest } from "../error/errorHandler.js";

const chatRouter = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

chatRouter.post("/", requireAuth, asyncHandler(async (req, res, next) => {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string" || !message.trim())
        return next(badRequest("El mensaje es requerido"));

    if (!Array.isArray(history))
        return next(badRequest("El historial debe ser un array"));

    const result = await chat({ message: message.trim(), history });
    res.status(200).json(result);
}));

export default chatRouter;