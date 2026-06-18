/**
 * goals.integration.test.js
 *
 * Prueba los endpoints reales de Express:
 *   GET    /api/goals
 *   POST   /api/goals
 *   POST   /api/goals/:id/contribute
 *   POST   /api/goals/:id/withdraw
 *   PATCH  /api/goals/:id
 *   DELETE /api/goals/:id
 *
 * Dependencias mockeadas:
 *   - pool (db/config.js) → nunca toca Postgres
 *
 * El JWT se genera localmente → no requiere /login real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { authHeader } from "./setup.js";

// ─── Mock del pool ─────────────────────────────────────────────────────────────

vi.mock("../../db/config.js", () => ({
    default: { query: vi.fn(), connect: vi.fn() },
}));

import pool from "../../db/config.js";

// Helper: crea un client de transacción con pool.connect()
function makeClient(responses = []) {
    const client = { query: vi.fn(), release: vi.fn() };
    responses.forEach(r => client.query.mockResolvedValueOnce(r));
    pool.connect.mockResolvedValue(client);
    return client;
}

// ─── Datos de prueba ───────────────────────────────────────────────────────────

const FAKE_GOAL_ROW = {
    id: 5,
    name: "Viaje a Europa",
    currency: "USD",
    currency_symbol: "$",
    target_amount: "3000",
    current_amount: "750",
    target_date: "2026-07-01",
    status: "active",
    created_at: new Date(),
    currency_id: 2,     // campo interno de la DB
    wallet_id: 10,
};

// ─── GET /api/goals ───────────────────────────────────────────────────────────
// getGoals: pool.query x3 (wallet, COUNT, SELECT goals)

describe("GET /api/goals", () => {
    beforeEach(() => vi.clearAllMocks());

    it("200 — devuelve lista de metas con paginación", async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 10 }] })          // SELECT wallet
            .mockResolvedValueOnce({ rows: [{ count: "1" }] })       // COUNT goals
            .mockResolvedValueOnce({ rows: [FAKE_GOAL_ROW] });       // SELECT goals JOIN currency

        const res = await request(app)
            .get("/api/goals")
            .set(authHeader())
            .query({ page: 1, limit: 10 });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("data");
        expect(res.body).toHaveProperty("pagination");
        expect(res.body.pagination).toHaveProperty("total", 1);
    });

    it("400 — rechaza página 0", async () => {
        const res = await request(app)
            .get("/api/goals")
            .set(authHeader())
            .query({ page: 0, limit: 10 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Página inválida/);
    });

    it("400 — rechaza límite mayor a 100", async () => {
        const res = await request(app)
            .get("/api/goals")
            .set(authHeader())
            .query({ page: 1, limit: 200 });

        expect(res.status).toBe(400);
    });

    it("401 — rechaza sin token", async () => {
        const res = await request(app).get("/api/goals");
        expect(res.status).toBe(401);
    });
});

// ─── POST /api/goals ──────────────────────────────────────────────────────────
// createGoal: pool.query x3 (wallet, currency, INSERT goal RETURNING)

describe("POST /api/goals", () => {
    beforeEach(() => vi.clearAllMocks());

    it("201 — crea una meta correctamente", async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 10 }] })          // SELECT wallet
            .mockResolvedValueOnce({ rows: [{ id: 2 }] })           // SELECT currency
            .mockResolvedValueOnce({ rows: [FAKE_GOAL_ROW] });      // INSERT goal RETURNING *

        const res = await request(app)
            .post("/api/goals")
            .set(authHeader())
            .send({ name: "Viaje a Europa", targetAmount: 3000, currency: "USD" });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("id");
        expect(res.body).toHaveProperty("name", "Viaje a Europa");
        expect(res.body).toHaveProperty("targetAmount", 3000);
    });

    it("400 — falla cuando falta el nombre", async () => {
        const res = await request(app)
            .post("/api/goals")
            .set(authHeader())
            .send({ targetAmount: 3000 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/nombre/i);
    });

    it("400 — falla cuando targetAmount es 0", async () => {
        const res = await request(app)
            .post("/api/goals")
            .set(authHeader())
            .send({ name: "Meta", targetAmount: 0 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Monto objetivo inválido/);
    });

    it("400 — falla cuando targetAmount es negativo", async () => {
        const res = await request(app)
            .post("/api/goals")
            .set(authHeader())
            .send({ name: "Meta", targetAmount: -500 });

        expect(res.status).toBe(400);
    });

    it("401 — rechaza sin token", async () => {
        const res = await request(app)
            .post("/api/goals")
            .send({ name: "Meta", targetAmount: 1000 });

        expect(res.status).toBe(401);
    });
});

// ─── POST /api/goals/:id/contribute ──────────────────────────────────────────
// contributeToGoal: pool.connect → BEGIN, wallet, goal, balance check,
//                  UPDATE balance, UPDATE goal RETURNING, INSERT txn, COMMIT

describe("POST /api/goals/:id/contribute", () => {
    beforeEach(() => vi.clearAllMocks());

    it("200 — realiza una contribución exitosa", async () => {
        makeClient([
            {},                                               // BEGIN
            { rows: [{ id: 10 }] },                           // SELECT wallet
            { rows: [FAKE_GOAL_ROW] },                        // SELECT goal WHERE id AND wallet_id
            { rows: [{ amount: "5000" }] },                   // SELECT balance (check)
            {},                                               // UPDATE balance (deducir)
            { rows: [{ ...FAKE_GOAL_ROW, current_amount: "1000", status: "active" }] }, // UPDATE goal RETURNING
            {},                                               // INSERT transaction
            {},                                               // COMMIT
        ]);

        const res = await request(app)
            .post("/api/goals/5/contribute")
            .set(authHeader())
            .send({ amount: 250 });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("currentAmount");
        expect(res.body).toHaveProperty("progress");
    });

    it("400 — rechaza monto 0 (sanitizeAmount)", async () => {
        const res = await request(app)
            .post("/api/goals/5/contribute")
            .set(authHeader())
            .send({ amount: 0 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/mayor a 0/);
    });

    it("400 — rechaza ID de meta no numérico", async () => {
        const res = await request(app)
            .post("/api/goals/abc/contribute")
            .set(authHeader())
            .send({ amount: 250 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/ID de meta inválido/);
    });

    it("401 — rechaza sin token", async () => {
        const res = await request(app)
            .post("/api/goals/5/contribute")
            .send({ amount: 250 });

        expect(res.status).toBe(401);
    });
});

// ─── POST /api/goals/:id/withdraw ─────────────────────────────────────────────
// withdrawFromGoal: BEGIN, wallet, goal, UPDATE balance, UPDATE goal RETURNING, INSERT txn, COMMIT

describe("POST /api/goals/:id/withdraw", () => {
    beforeEach(() => vi.clearAllMocks());

    it("200 — realiza un retiro de meta exitoso", async () => {
        makeClient([
            {},                                              // BEGIN
            { rows: [{ id: 10 }] },                          // SELECT wallet
            { rows: [FAKE_GOAL_ROW] },                       // SELECT goal
            {},                                              // UPDATE balance (reembolso)
            { rows: [{ ...FAKE_GOAL_ROW, current_amount: "550" }] }, // UPDATE goal RETURNING
            {},                                              // INSERT transaction
            {},                                              // COMMIT
        ]);

        const res = await request(app)
            .post("/api/goals/5/withdraw")
            .set(authHeader())
            .send({ amount: 200 });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("withdrawn", 200);
        expect(res.body).toHaveProperty("currentAmount");
    });

    it("400 — rechaza monto 0", async () => {
        const res = await request(app)
            .post("/api/goals/5/withdraw")
            .set(authHeader())
            .send({ amount: 0 });

        expect(res.status).toBe(400);
    });

    it("400 — rechaza ID inválido", async () => {
        const res = await request(app)
            .post("/api/goals/abc/withdraw")
            .set(authHeader())
            .send({ amount: 100 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/ID de meta inválido/);
    });

    it("401 — rechaza sin token", async () => {
        const res = await request(app)
            .post("/api/goals/5/withdraw")
            .send({ amount: 200 });

        expect(res.status).toBe(401);
    });
});

// ─── PATCH /api/goals/:id ─────────────────────────────────────────────────────
// updateGoal: pool.query x3 (wallet, goal, UPDATE RETURNING)

describe("PATCH /api/goals/:id", () => {
    beforeEach(() => vi.clearAllMocks());

    it("200 — actualiza el nombre de una meta activa", async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 10 }] })         // SELECT wallet
            .mockResolvedValueOnce({ rows: [FAKE_GOAL_ROW] })       // SELECT goal (status check)
            .mockResolvedValueOnce({ rows: [{ ...FAKE_GOAL_ROW, name: "Nuevo nombre" }] }); // UPDATE RETURNING

        const res = await request(app)
            .patch("/api/goals/5")
            .set(authHeader())
            .send({ name: "Nuevo nombre" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("name", "Nuevo nombre");
    });

    it("200 — actualiza el targetAmount de una meta activa", async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 10 }] })
            .mockResolvedValueOnce({ rows: [FAKE_GOAL_ROW] })
            .mockResolvedValueOnce({ rows: [{ ...FAKE_GOAL_ROW, target_amount: "5000" }] });

        const res = await request(app)
            .patch("/api/goals/5")
            .set(authHeader())
            .send({ targetAmount: 5000 });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("targetAmount", 5000);
    });

    it("400 — falla cuando no se envía ningún campo para actualizar", async () => {
        const res = await request(app)
            .patch("/api/goals/5")
            .set(authHeader())
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/al menos un campo/);
    });

    it("400 — rechaza ID inválido", async () => {
        const res = await request(app)
            .patch("/api/goals/abc")
            .set(authHeader())
            .send({ name: "Nuevo nombre" });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/ID de meta inválido/);
    });

    it("401 — rechaza sin token", async () => {
        const res = await request(app)
            .patch("/api/goals/5")
            .send({ name: "Nuevo nombre" });

        expect(res.status).toBe(401);
    });
});

// ─── DELETE /api/goals/:id ────────────────────────────────────────────────────
// deleteGoal: pool.connect → BEGIN, wallet, goal,
//             si current_amount > 0: UPDATE balance + INSERT txn
//             DELETE goal, COMMIT

describe("DELETE /api/goals/:id", () => {
    beforeEach(() => vi.clearAllMocks());

    it("200 — elimina una meta con saldo y devuelve el monto reembolsado", async () => {
        makeClient([
            {},                            // BEGIN
            { rows: [{ id: 10 }] },        // SELECT wallet
            { rows: [FAKE_GOAL_ROW] },     // SELECT goal (current_amount: "750" > 0)
            {},                            // UPDATE balance (reembolso)
            {},                            // INSERT transaction (retiro)
            {},                            // DELETE goal
            {},                            // COMMIT
        ]);

        const res = await request(app)
            .delete("/api/goals/5")
            .set(authHeader());

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("message");
        expect(res.body.message).toMatch(/eliminada/i);
    });

    it("200 — elimina una meta con saldo 0 sin reembolso", async () => {
        makeClient([
            {},                                                                   // BEGIN
            { rows: [{ id: 10 }] },                                               // SELECT wallet
            { rows: [{ ...FAKE_GOAL_ROW, current_amount: "0" }] },                // SELECT goal (0 → sin reembolso)
            {},                                                                   // DELETE goal
            {},                                                                   // COMMIT
        ]);

        const res = await request(app)
            .delete("/api/goals/5")
            .set(authHeader());

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("message");
    });

    it("400 — rechaza ID inválido", async () => {
        const res = await request(app)
            .delete("/api/goals/abc")
            .set(authHeader());

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/ID de meta inválido/);
    });

    it("401 — rechaza sin token", async () => {
        const res = await request(app).delete("/api/goals/5");
        expect(res.status).toBe(401);
    });
});
