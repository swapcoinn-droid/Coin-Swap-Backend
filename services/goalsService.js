import pool from "../db/config.js";
import { notFound, badRequest } from "../error/errorHandler.js";

export async function getGoals(userId) {
    const walletResult = await pool.query(
        `SELECT id FROM wallet WHERE user_id = $1`,
        [userId]
    );
    if (!walletResult.rows[0]) throw notFound("Wallet no encontrada");
    const walletId = walletResult.rows[0].id;

    const result = await pool.query(
        `SELECT
            g.id,
            g.name,
            g.target_amount,
            g.current_amount,
            g.target_date,
            g.status,
            g.created_at,
            c.code   AS currency,
            c.symbol AS currency_symbol
         FROM savings_goal g
         JOIN currency c ON c.id = g.currency_id
         WHERE g.wallet_id = $1
         ORDER BY g.created_at DESC`,
        [walletId]
    );

    return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        currency: row.currency,
        currencySymbol: row.currency_symbol,
        targetAmount: Number(row.target_amount),
        currentAmount: Number(row.current_amount),
        progress: +((Number(row.current_amount) / Number(row.target_amount)) * 100).toFixed(2),
        targetDate: row.target_date,
        status: row.status,
        createdAt: row.created_at
    }));
}

export async function createGoal({ userId, name, targetAmount, currencyCode = "COP", targetDate }) {
    const walletResult = await pool.query(
        `SELECT id FROM wallet WHERE user_id = $1`,
        [userId]
    );
    if (!walletResult.rows[0]) throw notFound("Wallet no encontrada");
    const walletId = walletResult.rows[0].id;

    const currencyResult = await pool.query(
        `SELECT id FROM currency WHERE code = $1`,
        [currencyCode]
    );
    if (!currencyResult.rows[0]) throw badRequest("Moneda no válida");
    const currencyId = currencyResult.rows[0].id;

    const result = await pool.query(
        `INSERT INTO savings_goal
         (wallet_id, currency_id, name, target_amount, target_date)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [walletId, currencyId, name, targetAmount, targetDate || null]
    );
    const row = result.rows[0];

    return {
        id: row.id,
        name: row.name,
        currency: currencyCode,
        targetAmount: Number(row.target_amount),
        currentAmount: Number(row.current_amount),
        progress: 0,
        targetDate: row.target_date,
        status: row.status,
        createdAt: row.created_at
    };
}

export async function contributeToGoal({ userId, goalId, amount }) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Obtener la wallet
        const walletResult = await client.query(
            `SELECT id FROM wallet WHERE user_id = $1`,
            [userId]
        );
        if (!walletResult.rows[0]) throw notFound("Wallet no encontrada");
        const walletId = walletResult.rows[0].id;

        // Obtener la meta y verificar que pertenezca a esta wallet
        const goalResult = await client.query(
            `SELECT * FROM savings_goal WHERE id = $1 AND wallet_id = $2`,
            [goalId, walletId]
        );
        if (!goalResult.rows[0]) throw notFound("Meta no encontrada");
        const goal = goalResult.rows[0];

        if (goal.status !== "active") throw badRequest("Esta meta ya no está activa");

        const remaining = Number(goal.target_amount) - Number(goal.current_amount);
        if (amount > remaining) throw badRequest(`El monto excede lo necesario, solo faltan ${remaining} para completar la meta`);

        // Verificar que el balance sea suficiente
        const balanceCheck = await client.query(
            `SELECT amount FROM balance
             WHERE wallet_id = $1 AND currency_id = $2`,
            [walletId, goal.currency_id]
        );
        if (Number(balanceCheck.rows[0].amount) < amount) {
            throw badRequest("Saldo insuficiente");
        }

        // Deducir del balance
        await client.query(
            `UPDATE balance SET amount = amount - $1
             WHERE wallet_id = $2 AND currency_id = $3`,
            [amount, walletId, goal.currency_id]
        );

        // Sumar a la meta
        const updatedGoal = await client.query(
            `UPDATE savings_goal
             SET current_amount = current_amount + $1,
                 status = CASE
                     WHEN current_amount + $1 >= target_amount THEN 'completed'
                     ELSE 'active'
                 END
             WHERE id = $2
             RETURNING *`,
            [amount, goalId]
        );
        const row = updatedGoal.rows[0];

        await client.query("COMMIT");
        return {
            id: row.id,
            name: row.name,
            targetAmount: Number(row.target_amount),
            currentAmount: Number(row.current_amount),
            progress: +((Number(row.current_amount) / Number(row.target_amount)) * 100).toFixed(2),
            status: row.status,
            completed: row.status === "completed"
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function withdrawFromGoal({ userId, goalId, amount }) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const walletResult = await client.query(
            `SELECT id FROM wallet WHERE user_id = $1`,
            [userId]
        );
        if (!walletResult.rows[0]) throw notFound("Wallet no encontrada");
        const walletId = walletResult.rows[0].id;

        // Obtener la meta y verificar que pertenezca a esta wallet
        const goalResult = await client.query(
            `SELECT * FROM savings_goal WHERE id = $1 AND wallet_id = $2`,
            [goalId, walletId]
        );
        if (!goalResult.rows[0]) throw notFound("Meta no encontrada");
        const goal = goalResult.rows[0];

        // No se puede retirar más de lo que se ha ahorrado
        if (amount > Number(goal.current_amount)) {
            throw badRequest(`No puedes retirar más de ${Number(goal.current_amount)} de esta meta`);
        }

        // Reembolsar al balance
        await client.query(
            `UPDATE balance SET amount = amount + $1
             WHERE wallet_id = $2 AND currency_id = $3`,
            [amount, walletId, goal.currency_id]
        );

        // Restar de la meta
        const updatedGoal = await client.query(
            `UPDATE savings_goal
             SET current_amount = current_amount - $1
             WHERE id = $2
             RETURNING *`,
            [amount, goalId]
        );
        const row = updatedGoal.rows[0];

        await client.query("COMMIT");
        return {
            id: row.id,
            name: row.name,
            targetAmount: Number(row.target_amount),
            currentAmount: Number(row.current_amount),
            progress: +((Number(row.current_amount) / Number(row.target_amount)) * 100).toFixed(2),
            status: row.status,
            withdrawn: amount
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function deleteGoal({ userId, goalId }) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const walletResult = await client.query(
            `SELECT id FROM wallet WHERE user_id = $1`,
            [userId]
        );
        if (!walletResult.rows[0]) throw notFound("Wallet no encontrada");
        const walletId = walletResult.rows[0].id;

        // Obtener la meta y verificar que pertenezca a esta wallet
        const goalResult = await client.query(
            `SELECT * FROM savings_goal WHERE id = $1 AND wallet_id = $2`,
            [goalId, walletId]
        );
        if (!goalResult.rows[0]) throw notFound("Meta no encontrada");
        const goal = goalResult.rows[0];

        // Devolver el monto actual a la billetera si hay algo ahorrado
        if (Number(goal.current_amount) > 0) {
            await client.query(
                `UPDATE balance SET amount = amount + $1
                 WHERE wallet_id = $2 AND currency_id = $3`,
                [goal.current_amount, walletId, goal.currency_id]
            );
        }

        // Borrar la meta
        await client.query(
            `DELETE FROM savings_goal WHERE id = $1`,
            [goalId]
        );

        await client.query("COMMIT");
        return {
            message: `Meta eliminada, ${Number(goal.current_amount)} devueltos a tu balance`
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}