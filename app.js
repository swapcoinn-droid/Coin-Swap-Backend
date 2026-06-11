import express from "express";
import cors from "cors";
import authRouter from './routes/auth.routes.js';
import ratesRouter from "./routes/rates.routes.js";
import walletRouter from "./routes/wallet.routes.js";
import goalsRouter from "./routes/goals.routes.js";
import { generalLimiter, authLimiter } from "./middleware/rateLimit.middleware.js";
import { errorHandler } from "./error/errorHandler.js";

const app = express();

// CORS para permitir peticiones desde origenes específicos
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://swap-coin-frontend.vercel.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Para parsear el cuerpo de las peticiones JSON
app.use(express.json());

// Rate limiter general para todas las rutas
app.use(generalLimiter);

// Rutas autenticadas con su propio rate limiter
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/rates", ratesRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/goals", goalsRouter);

// Manejo de errores
app.use(errorHandler);

export default app;