import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { findByEmail } from "./usersService.js";
import { unauthorized } from "../error/errorHandler.js";

export async function login({ email, password }) {
    const user = await findByEmail(email);
    if (!user) throw unauthorized("Credenciales inválidas");

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw unauthorized("Credenciales inválidas");

    const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
    );
    return { token, user: { id: user.id, name: user.name, email: user.email } };
}