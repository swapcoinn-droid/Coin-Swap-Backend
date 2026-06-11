import express from "express";
import { getWallet } from "../services/walletService.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const walletRouter = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

walletRouter.get("/", requireAuth, asyncHandler(async (req, res) => {
    const wallet = await getWallet(req.user.id);
    res.status(200).json(wallet);
}));

export default walletRouter;