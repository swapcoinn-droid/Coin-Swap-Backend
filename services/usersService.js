import pool from "../db/config.js";
import bcrypt from "bcrypt";
import { conflict, notFound } from "../error/errorHandler.js";

export async function register({ name, email, password }) {
    const password_hash = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Insertar usuario
        const userResult = await client.query(
            `INSERT INTO users (name, email, password_hash)
             VALUES ($1, $2, $3) RETURNING id, name, email, created_at`,
            [name, email, password_hash]
        );
        const user = userResult.rows[0];

        // Crear wallet del usuario
        const walletResult = await client.query(
            `INSERT INTO wallet (user_id) VALUES ($1) RETURNING id`,
            [user.id]
        );
        const walletId = walletResult.rows[0].id;

        // Insertar balances iniciales en 0
        await client.query(
            `INSERT INTO balance (wallet_id, currency_id, amount)
             SELECT $1, id, 0 FROM currency ORDER BY (code = 'COP') DESC`,
            [walletId]
        );

        await client.query('COMMIT');
        return user;
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') throw conflict('El email ya está en uso');
        throw error;
    } finally {
        client.release();
    }
}

export async function findByEmail(email) {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0] || null;
}