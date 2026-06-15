import pool from "../db/config.js";
import { getRates, convert } from "./exchangeRateService.js";
import { findById } from "./usersService.js";
import { sendDepositEmail, sendWithdrawEmail, sendExchangeEmail } from "./emailService.js";
import { notFound, badRequest } from "../error/errorHandler.js";

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

export async function deposit({ userId, amount, currencyCode = "COP" }) {
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

        // Obtener la moneda
        const currencyResult = await client.query(
            `SELECT id FROM currency WHERE code = $1`,
            [currencyCode]
        );
        if (!currencyResult.rows[0]) throw badRequest("Moneda no válida");
        const currencyId = currencyResult.rows[0].id;

        // Actualizar balance
        const balanceResult = await client.query(
            `UPDATE balance SET amount = amount + $1
             WHERE wallet_id = $2 AND currency_id = $3
             RETURNING amount`,
            [amount, walletId, currencyId]
        );

        // Insertar registro de transacción
        await client.query(
            `INSERT INTO transaction
             (type, amount, currency_id, source_wallet_id, description)
             VALUES ('deposit', $1, $2, $3, $4)`,
            [amount, currencyId, walletId, `Depósito de ${amount} ${currencyCode}`]
        );

        await client.query("COMMIT");

        // Email de confirmación de depósito
        const user = await findById(userId);
        console.log("[DEBUG] Sending email to:", user?.email, "| User found:", !!user);
        const emailResult = await sendDepositEmail({
            to: user.email,
            name: user.name,
            amount,
            currency: currencyCode,
            newBalance: Number(balanceResult.rows[0].amount),
        });
        console.log("[DEBUG] Email result:", emailResult);
        return {
            currency: currencyCode,
            deposited: amount,
            newBalance: Number(balanceResult.rows[0].amount),
            notification: emailResult?.ok ? "Enviado" : "Error al enviar"
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function withdraw({ userId, amount, currencyCode = "COP" }) {
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

        // Obtener la moneda
        const currencyResult = await client.query(
            `SELECT id FROM currency WHERE code = $1`,
            [currencyCode]
        );
        if (!currencyResult.rows[0]) throw badRequest("Moneda no válida");
        const currencyId = currencyResult.rows[0].id;

        // Verificar que el balance sea suficiente antes de hacer algop
        const balanceCheck = await client.query(
            `SELECT amount FROM balance
             WHERE wallet_id = $1 AND currency_id = $2`,
            [walletId, currencyId]
        );
        if (Number(balanceCheck.rows[0].amount) < amount) {
            throw badRequest("Saldo insuficiente");
        }

        // Actualizar el balance
        const balanceResult = await client.query(
            `UPDATE balance SET amount = amount - $1
             WHERE wallet_id = $2 AND currency_id = $3
             RETURNING amount`,
            [amount, walletId, currencyId]
        );

        // Insertar registro de transacción
        await client.query(
            `INSERT INTO transaction
             (type, amount, currency_id, source_wallet_id, description)
             VALUES ('withdrawal', $1, $2, $3, $4)`,
            [amount, currencyId, walletId, `Retiro de ${amount} ${currencyCode}`]
        );

        await client.query("COMMIT");

        // Email de confirmación de retiro
        const user = await findById(userId);
        console.log("[DEBUG] Sending email to:", user?.email, "| User found:", !!user);
        const emailResult = await sendWithdrawEmail({
            to: user.email,
            name: user.name,
            amount,
            currency: currencyCode,
            newBalance: Number(balanceResult.rows[0].amount),
        });
        console.log("[DEBUG] Email result:", emailResult);
        return {
            currency: currencyCode,
            withdrawn: amount,
            newBalance: Number(balanceResult.rows[0].amount),
            notification: emailResult?.ok ? "Enviado" : "Error al enviar"
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function exchange({ userId, fromCode, toCode, amount }) {
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

        // Obtener ambas monedas
        const currencyResult = await client.query(
            `SELECT id, code FROM currency WHERE code = ANY($1)`,
            [[fromCode, toCode]]
        );
        if (currencyResult.rows.length < 2) throw badRequest("Moneda no válida");
        const fromCurrency = currencyResult.rows.find(c => c.code === fromCode);
        const toCurrency = currencyResult.rows.find(c => c.code === toCode);

        // Verificar el balance de la moneda seleccionada
        const balanceCheck = await client.query(
            `SELECT amount FROM balance
             WHERE wallet_id = $1 AND currency_id = $2`,
            [walletId, fromCurrency.id]
        );
        if (Number(balanceCheck.rows[0].amount) < amount) {
            throw badRequest("Saldo insuficiente");
        }

        // Obtener el rate en tiempo real y calcular el monto recibido
        const rates = await getRates();
        const receivedAmount = await convert(amount, fromCode, toCode);
        const appliedRate = +(rates[toCode] / rates[fromCode]).toFixed(6);

        // Restar el monto de la moneda seleccionada
        await client.query(
            `UPDATE balance SET amount = amount - $1
             WHERE wallet_id = $2 AND currency_id = $3`,
            [amount, walletId, fromCurrency.id]
        );

        // Sumar el monto de la moneda seleccionada
        await client.query(
            `UPDATE balance SET amount = amount + $1
             WHERE wallet_id = $2 AND currency_id = $3`,
            [receivedAmount, walletId, toCurrency.id]
        );

        // Insertar registro de transacción
        const txnResult = await client.query(
            `INSERT INTO transaction
             (type, amount, currency_id, source_wallet_id, description, exchange_rate, target_currency_id)
             VALUES ('exchange', $1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
                amount,
                fromCurrency.id,
                walletId,
                `Exchange ${amount} ${fromCode} → ${receivedAmount} ${toCode}`,
                appliedRate,
                toCurrency.id
            ]
        );
        const txnId = txnResult.rows[0].id;

        // Registro del double-entry ledger
        await client.query(
            `INSERT INTO ledger_entry (transaction_id, wallet_id, currency_id, amount, entry_type)
             VALUES ($1, $2, $3, $4, 'debit')`,
            [txnId, walletId, fromCurrency.id, -amount]
        );
        await client.query(
            `INSERT INTO ledger_entry (transaction_id, wallet_id, currency_id, amount, entry_type)
             VALUES ($1, $2, $3, $4, 'credit')`,
            [txnId, walletId, toCurrency.id, receivedAmount]
        );

        await client.query("COMMIT");

        // Email de confirmación de intercambio de divisas
        const user = await findById(userId);
        console.log("[DEBUG] Sending email to:", user?.email, "| User found:", !!user);
        const emailResult = await sendExchangeEmail({
            to: user.email,
            name: user.name,
            fromAmount: amount,
            fromCurrency: fromCode,
            toAmount: receivedAmount,
            toCurrency: toCode,
            appliedRate,
        });
        console.log("[DEBUG] Email result:", emailResult);
        return {
            from: { currency: fromCode, debited: amount },
            to: { currency: toCode, credited: receivedAmount },
            appliedRate,
            notification: emailResult?.ok ? "Enviado" : "Error al enviar"
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function getTransactions(userId, { page = 1, limit = 10 } = {}) {
    const walletResult = await pool.query(
        `SELECT id FROM wallet WHERE user_id = $1`,
        [userId]
    );
    if (!walletResult.rows[0]) throw notFound("Wallet no encontrada");
    const walletId = walletResult.rows[0].id;

    const offset = (page - 1) * limit;

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM transaction WHERE source_wallet_id = $1`,
        [walletId]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
        `SELECT 
            t.id,
            t.type,
            t.amount,
            t.description,
            t.exchange_rate,
            t.created_at,
            c.code AS currency,
            c.symbol AS currency_symbol,
            tc.code AS target_currency,
            tc.symbol AS target_currency_symbol
         FROM transaction t
         JOIN currency c ON c.id = t.currency_id
         LEFT JOIN currency tc ON tc.id = t.target_currency_id
         WHERE t.source_wallet_id = $1
         ORDER BY t.created_at DESC
         LIMIT $2 OFFSET $3`,
        [walletId, limit, offset]
    );

    return {
        data: result.rows.map(row => ({
            id: row.id,
            type: row.type,
            amount: Number(row.amount),
            currency: row.currency,
            currencySymbol: row.currency_symbol,
            targetCurrency: row.target_currency || null,
            targetCurrencySymbol: row.target_currency_symbol || null,
            exchangeRate: row.exchange_rate ? Number(row.exchange_rate) : null,
            description: row.description,
            createdAt: row.created_at
        })),
        pagination: {
            total,
            page: +page,
            limit: +limit,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPrevPage: page > 1
        }
    };
}