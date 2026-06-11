import express from "express";
import cors from "cors";
import authRouter from './routes/auth.routes.js';
import ratesRouter from "./routes/rates.routes.js";
import walletRouter from "./routes/wallet.routes.js";
import { errorHandler } from "./error/errorHandler.js";

const app = express();

app.use(express.json());

app.use("/api/rates", ratesRouter);

app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://swap-coin-frontend.vercel.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use("/api/auth", authRouter);
app.use("/api/wallet", walletRouter);
app.use(errorHandler);

export default app;