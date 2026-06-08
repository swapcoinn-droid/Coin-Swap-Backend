import express from "express";
import authRouter from './routes/auth.routes.js';
import { errorHandler } from "./error/errorHandler.js";

const app = express();

app.use(express.json());

app.use("/api/auth", authRouter);

// Manejador de errores global
app.use(errorHandler);

export default app;