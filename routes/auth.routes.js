import express from "express";
import { register } from "../services/usersService.js";
import { login } from "../services/authService.js";
import { validateRegister, validateLogin } from "../middleware/auth.validate.js";

const authRouter = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

authRouter.post("/register", validateRegister, asyncHandler(async (req, res) => {
    const user = await register(req.body);
    res.status(201).json(user);
}));

authRouter.post("/login", validateLogin, asyncHandler(async (req, res) => {
    const result = await login(req.body);
    res.status(200).json(result);
}));

export default authRouter;