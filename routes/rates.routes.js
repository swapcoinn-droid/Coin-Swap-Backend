import express from "express";
import { getRates } from "../services/exchangeRateService.js";

const ratesRouter = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

ratesRouter.get("/", asyncHandler(async (req, res) => {
    const rates = await getRates();

    res.status(200).json({
        base: "USD",
        rates: {
            USD: 1,
            COP: rates["COP"],
            EUR: rates["EUR"],
        },
        updatedAt: new Date().toISOString()
    });
}));

export default ratesRouter;