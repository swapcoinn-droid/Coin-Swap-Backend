import pool from "../db/config.js";
import bcrypt from "bcrypt";
import { conflict, notFound } from "../error/errorHandler.js";

export async function register({ username, email, password }) {
    const password_hash = await bcrypt.hash(password, 10);
    try {
        const result = await pool.query(
            "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at",
            [username, email, password_hash]
        );
        return result.rows[0];
    } catch (error) {
        if (error.code === "23505") throw conflict("El email o username ya está en uso");
        throw error;
    }
}

export async function findByEmail(email) {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0] || null;
}