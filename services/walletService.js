import pool from "../db/config.js";
import { convert } from "./exchangeRateService.js";
import { notFound } from "../error/errorHandler.js";

export async function getWallet(userId) {
    // Obtener la wallet
    const walletResult = await pool.query(
        `SELECT id FROM wallet WHERE user_id = $1`,
        [userId]
    );
    if (!walletResult.rows[0]) throw notFound("Wallet no encontrada");
    const walletId = walletResult.rows[0].id;

    // Obtener todos los balances con información de su moneda
    const balanceResult = await pool.query(
        `SELECT b.amount, c.code, c.name, c.symbol
         FROM balance b
         JOIN currency c ON c.id = b.currency_id
         WHERE b.wallet_id = $1
         ORDER BY (c.code = 'COP') DESC`,
        [walletId]
    );

    // Convertir cada balance a COP para el total
    const balances = await Promise.all(
        balanceResult.rows.map(async (row) => {
            const inCOP = await convert(Number(row.amount), row.code, "COP");
            return {
                currency: row.code,
                name: row.name,
                symbol: row.symbol,
                amount: Number(row.amount),
                estimatedCOP: inCOP
            };
        })
    );

    const totalCOP = balances.reduce((sum, b) => sum + b.estimatedCOP, 0);

    return {
        walletId,
        balances,
        totalEstimatedCOP: +totalCOP.toFixed(2)
    };
}