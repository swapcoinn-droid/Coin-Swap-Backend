/**
 * wallet.integration.test.js
 *
 * Prueba los endpoints reales de Express:
 *   GET  /api/wallet
 *   POST /api/wallet/deposit
 *   POST /api/wallet/withdraw
 *   POST /api/wallet/exchange
 *   GET  /api/wallet/transactions
 *
 * Dependencias mockeadas:
 *   - pool (db/config.js)         → nunca toca Postgres
 *   - emailService.js             → nunca envía emails por AWS SES
 *   - exchangeRateService.js      → nunca llama a la API de tasas
 *
 * El JWT se genera localmente con makeToken() → no requiere /login real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { authHeader } from "./setup.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../db/config.js", () => ({
    default: { query: vi.fn(), connect: vi.fn() },
}));

vi.mock("../../services/emailService.js", () => ({
    sendDepositEmail:  vi.fn().mockResolvedValue({ ok: true }),
    sendWithdrawEmail: vi.fn().mockResolvedValue({ ok: true }),
    sendExchangeEmail: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../../services/exchangeRateService.js", () => ({
    getRates: vi.fn(),
    convert:  vi.fn(),
}));

import pool from "../../db/config.js";
import { getRates, convert } from "../../services/exchangeRateService.js";

const FAKE_RATES = { USD: 1, COP: 4150.5, EUR: 0.92 };

// Helper: crea un client de transacción (pool.connect) con respuestas predefinidas
function makeClient(responses = []) {
    const client = { query: vi.fn(), release: vi.fn() };
    responses.forEach(r => client.query.mockResolvedValueOnce(r));
    pool.connect.mockResolvedValue(client);
    return client;
}

// ─── GET /api/wallet ──────────────────────────────────────────────────────────
// getWallet: pool.query x2 (wallet, balances) + convert por cada balance

describe("GET /api/wallet", () => {
    beforeEach(() => vi.clearAllMocks());

    it("200 — devuelve balances y totalEstimatedCOP", async () => {
        getRates.mockResolvedValue(FAKE_RATES);
        convert.mockResolvedValue(250000); // estimatedCOP de cada balance

        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 10 }] })   // SELECT wallet
            .mockResolvedValueOnce({ rows: [             // SELECT balances
                { amount: "250000", code: "COP", name: "Peso Colombiano", symbol: "$" },
                { amount: "100",    code: "USD", name: "Dólar",           symbol: "US$" },
            ]});

        const res = await request(app)
            .get("/api/wallet")
            .set(authHeader());

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("balances");
        expect(res.body).toHaveProperty("totalEstimatedCOP");
        expect(Array.isArray(res.body.balances)).toBe(true);
    });

    it("401 — rechaza petición sin token", async () => {
        const res = await request(app).get("/api/wallet");
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/Token/);
    });

    it("401 — rechaza token malformado", async () => {
        const res = await request(app)
            .get("/api/wallet")
            .set("Authorization", "Bearer token-basura");
        expect(res.status).toBe(401);
    });
});

// ─── POST /api/wallet/deposit ─────────────────────────────────────────────────
// deposit: pool.connect → BEGIN, wallet, currency, UPDATE balance, INSERT txn, COMMIT
// luego: findById (pool.query) + sendDepositEmail (mockeado)

describe("POST /api/wallet/deposit", () => {
    beforeEach(() => vi.clearAllMocks());

    it("200 — registra un depósito y devuelve el nuevo balance", async () => {
        const client = makeClient([
            {},                                           // BEGIN
            { rows: [{ id: 10 }] },                       // SELECT wallet
            { rows: [{ id: 1 }] },                        // SELECT currency COP
            { rows: [{ amount: "300000" }] },             // UPDATE balance RETURNING amount
            {},                                           // INSERT transaction
            {},                                           // COMMIT
        ]);

        // findById se llama después del COMMIT (con pool.query, no client.query)
        pool.query.mockResolvedValueOnce({ rows: [{ id: 99, name: "Test", email: "t@t.com" }] });

        const res = await request(app)
            .post("/api/wallet/deposit")
            .set(authHeader())
            .send({ amount: 50000, currency: "COP" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("deposited", 50000);
        expect(res.body).toHaveProperty("newBalance");
    });

    it("400 — rechaza monto 0 (sanitizeAmount middleware)", async () => {
        const res = await request(app)
            .post("/api/wallet/deposit")
            .set(authHeader())
            .send({ amount: 0 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/mayor a 0/);
    });

    it("400 — rechaza monto negativo", async () => {
        const res = await request(app)
            .post("/api/wallet/deposit")
            .set(authHeader())
            .send({ amount: -100 });

        expect(res.status).toBe(400);
    });

    it("400 — rechaza monto no numérico (string)", async () => {
        const res = await request(app)
            .post("/api/wallet/deposit")
            .set(authHeader())
            .send({ amount: "cincuenta" });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/número/);
    });

    it("400 — rechaza monto con más de 2 decimales", async () => {
        const res = await request(app)
            .post("/api/wallet/deposit")
            .set(authHeader())
            .send({ amount: 100.999 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/2 decimales/);
    });

    it("401 — rechaza sin token", async () => {
        const res = await request(app)
            .post("/api/wallet/deposit")
            .send({ amount: 50000 });

        expect(res.status).toBe(401);
    });
});

// ─── POST /api/wallet/withdraw ────────────────────────────────────────────────
// withdraw: BEGIN, wallet, currency, CHECK balance, UPDATE balance, INSERT txn, COMMIT
// luego: findById + sendWithdrawEmail

describe("POST /api/wallet/withdraw", () => {
    beforeEach(() => vi.clearAllMocks());

    it("200 — registra un retiro exitoso", async () => {
        const client = makeClient([
            {},                                            // BEGIN
            { rows: [{ id: 10 }] },                        // SELECT wallet
            { rows: [{ id: 1 }] },                         // SELECT currency
            { rows: [{ amount: "250000" }] },              // SELECT balance (check)
            { rows: [{ amount: "230000" }] },              // UPDATE balance RETURNING
            {},                                            // INSERT transaction
            {},                                            // COMMIT
        ]);

        pool.query.mockResolvedValueOnce({ rows: [{ id: 99, name: "Test", email: "t@t.com" }] });

        const res = await request(app)
            .post("/api/wallet/withdraw")
            .set(authHeader())
            .send({ amount: 20000, currency: "COP" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("withdrawn", 20000);
        expect(res.body).toHaveProperty("newBalance");
    });

    it("400 — rechaza monto 0", async () => {
        const res = await request(app)
            .post("/api/wallet/withdraw")
            .set(authHeader())
            .send({ amount: 0 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/mayor a 0/);
    });

    it("401 — rechaza sin token", async () => {
        const res = await request(app)
            .post("/api/wallet/withdraw")
            .send({ amount: 20000 });

        expect(res.status).toBe(401);
    });
});

// ─── POST /api/wallet/exchange ────────────────────────────────────────────────
// exchange: BEGIN, wallet, ambas currencies (1 query), check balance,
//           getRates+convert, UPDATE from, UPDATE to, INSERT txn, INSERT ledger x2, COMMIT
// luego: findById + sendExchangeEmail

describe("POST /api/wallet/exchange", () => {
    beforeEach(() => vi.clearAllMocks());

    it("200 — realiza un exchange USD → COP", async () => {
        getRates.mockResolvedValue(FAKE_RATES);
        convert.mockResolvedValue(415050); // 100 USD → COP

        const client = makeClient([
            {},                                                           // BEGIN
            { rows: [{ id: 10 }] },                                       // SELECT wallet
            { rows: [{ id: 2, code: "USD" }, { id: 1, code: "COP" }] },  // SELECT currencies ANY
            { rows: [{ amount: "500" }] },                                // SELECT balance check
            {},                                                           // UPDATE balance FROM
            {},                                                           // UPDATE balance TO
            { rows: [{ id: 44 }] },                                       // INSERT transaction RETURNING id
            {},                                                           // INSERT ledger debit
            {},                                                           // INSERT ledger credit
            {},                                                           // COMMIT
        ]);

        pool.query.mockResolvedValueOnce({ rows: [{ id: 99, name: "Test", email: "t@t.com" }] });

        const res = await request(app)
            .post("/api/wallet/exchange")
            .set(authHeader())
            .send({ from: "USD", to: "COP", amount: 100 });

        expect(res.status).toBe(200);
        expect(res.body.from).toHaveProperty("currency", "USD");
        expect(res.body.to).toHaveProperty("currency", "COP");
        expect(res.body).toHaveProperty("appliedRate");
    });

    it("400 — rechaza when from === to", async () => {
        const res = await request(app)
            .post("/api/wallet/exchange")
            .set(authHeader())
            .send({ from: "USD", to: "USD", amount: 100 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/diferentes/);
    });

    it("400 — rechaza cuando falta 'from'", async () => {
        const res = await request(app)
            .post("/api/wallet/exchange")
            .set(authHeader())
            .send({ to: "COP", amount: 100 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Datos inválidos/);
    });

    it("400 — rechaza monto 0", async () => {
        const res = await request(app)
            .post("/api/wallet/exchange")
            .set(authHeader())
            .send({ from: "USD", to: "COP", amount: 0 });

        expect(res.status).toBe(400);
    });

    it("401 — rechaza sin token", async () => {
        const res = await request(app)
            .post("/api/wallet/exchange")
            .send({ from: "USD", to: "COP", amount: 100 });

        expect(res.status).toBe(401);
    });
});

// ─── GET /api/wallet/transactions ────────────────────────────────────────────
// getTransactions: pool.query x3 (wallet, COUNT, SELECT rows)

describe("GET /api/wallet/transactions", () => {
    beforeEach(() => vi.clearAllMocks());

    it("200 — devuelve transacciones con campo 'data' y 'pagination'", async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 10 }] })          // SELECT wallet
            .mockResolvedValueOnce({ rows: [{ count: "3" }] })       // COUNT
            .mockResolvedValueOnce({ rows: [                         // SELECT transactions
                { id: 1, type: "deposit",    amount: "50000", currency: "COP", currency_symbol: "$",  target_currency: null, target_currency_symbol: null, exchange_rate: null, description: "Depósito", created_at: new Date() },
                { id: 2, type: "withdrawal", amount: "10000", currency: "COP", currency_symbol: "$",  target_currency: null, target_currency_symbol: null, exchange_rate: null, description: "Retiro",   created_at: new Date() },
                { id: 3, type: "exchange",   amount: "100",   currency: "USD", currency_symbol: "US$", target_currency: "COP", target_currency_symbol: "$", exchange_rate: "4150.5", description: "Exchange", created_at: new Date() },
            ]});

        const res = await request(app)
            .get("/api/wallet/transactions")
            .set(authHeader())
            .query({ page: 1, limit: 10 });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("data");        // la ruta devuelve `data`, no `transactions`
        expect(res.body).toHaveProperty("pagination");
        expect(res.body.pagination).toHaveProperty("total", 3);
    });

    it("400 — rechaza página inválida (0)", async () => {
        const res = await request(app)
            .get("/api/wallet/transactions")
            .set(authHeader())
            .query({ page: 0, limit: 10 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Página inválida/);
    });

    it("400 — rechaza límite mayor a 100", async () => {
        const res = await request(app)
            .get("/api/wallet/transactions")
            .set(authHeader())
            .query({ page: 1, limit: 101 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/límite máximo/i);
    });

    it("401 — rechaza sin token", async () => {
        const res = await request(app).get("/api/wallet/transactions");
        expect(res.status).toBe(401);
    });
});
