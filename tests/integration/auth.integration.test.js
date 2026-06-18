/**
 * auth.integration.test.js
 *
 * Prueba los endpoints reales de Express:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *
 * La DB (pool) se mockea → nunca sale a Postgres.
 * El servicio de auth se mockea para login → evita problemas con bcrypt ESM.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// JWT_SECRET debe estar seteado ANTES de que app.js importe authService
process.env.JWT_SECRET = "test-secret-key";
process.env.NODE_ENV   = "test";

import app from "../../app.js";

// ─── Mocks de módulos ──────────────────────────────────────────────────────────

vi.mock("../../db/config.js", () => ({
    default: {
        query:   vi.fn(),
        connect: vi.fn(),
    },
}));

// Mockeamos bcrypt a nivel de módulo ESM
vi.mock("bcrypt", () => ({
    default: {
        hash:    vi.fn().mockResolvedValue("$hashed$"),
        compare: vi.fn(),
    },
}));

import pool from "../../db/config.js";
import bcrypt from "bcrypt";

// ─── Datos de prueba ───────────────────────────────────────────────────────────

const REGISTERED_USER = {
    id: 1,
    name: "María García",
    email: "maria@example.com",
    created_at: new Date().toISOString(),
};

const USER_WITH_HASH = {
    ...REGISTERED_USER,
    password_hash: "$hashed$",
};

// Helper: mockea un client de transacción que usa pool.connect()
function makeTransactionClient(responses = []) {
    const client = { query: vi.fn(), release: vi.fn() };
    responses.forEach(r => client.query.mockResolvedValueOnce(r));
    pool.connect.mockResolvedValue(client);
    return client;
}

// ─── Tests: POST /api/auth/register ───────────────────────────────────────────

describe("POST /api/auth/register", () => {
    beforeEach(() => vi.clearAllMocks());

    it("201 — registra un usuario y devuelve sus datos (sin password_hash)", async () => {
        // usersService.register usa pool.connect() → transacción con 5 queries
        makeTransactionClient([
            {},                              // BEGIN
            { rows: [REGISTERED_USER] },     // INSERT users RETURNING
            { rows: [{ id: 10 }] },          // INSERT wallet RETURNING id
            {},                              // INSERT balance (sin RETURNING)
            {},                              // COMMIT
        ]);

        const res = await request(app)
            .post("/api/auth/register")
            .send({ name: "María García", email: "maria@example.com", password: "secret123" });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("id", 1);
        expect(res.body).toHaveProperty("email", "maria@example.com");
        expect(res.body).not.toHaveProperty("password_hash");
    });

    it("400 — falla cuando falta el nombre", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({ email: "maria@example.com", password: "secret123" });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty("error");
    });

    it("400 — falla cuando falta la contraseña", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({ name: "María", email: "maria@example.com" });

        expect(res.status).toBe(400);
    });

    it("400 — falla cuando la contraseña tiene menos de 6 caracteres", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({ name: "María", email: "maria@example.com", password: "abc" });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/6 caracteres/);
    });

    it("409 — falla cuando el email ya está en uso (unique constraint de Postgres)", async () => {
        const client = makeTransactionClient([
            {},    // BEGIN
        ]);
        // La segunda query lanza el error de clave duplicada
        client.query.mockRejectedValueOnce({ code: "23505" }); // INSERT users
        client.query.mockResolvedValueOnce({});                  // ROLLBACK

        const res = await request(app)
            .post("/api/auth/register")
            .send({ name: "María", email: "duplicado@example.com", password: "secret123" });

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/email/i);
    });
});

// ─── Tests: POST /api/auth/login ──────────────────────────────────────────────

describe("POST /api/auth/login", () => {
    beforeEach(() => vi.clearAllMocks());

    it("200 — devuelve token y datos del usuario con credenciales válidas", async () => {
        // findByEmail → pool.query devuelve el usuario con hash
        pool.query.mockResolvedValueOnce({ rows: [USER_WITH_HASH] });
        // bcrypt.compare → true (contraseña correcta)
        bcrypt.compare.mockResolvedValueOnce(true);

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "maria@example.com", password: "secret123" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("token");
        expect(typeof res.body.token).toBe("string");
        expect(res.body.user).toHaveProperty("email", "maria@example.com");
        expect(res.body.user).not.toHaveProperty("password_hash");
    });

    it("401 — falla con contraseña incorrecta", async () => {
        pool.query.mockResolvedValueOnce({ rows: [USER_WITH_HASH] });
        bcrypt.compare.mockResolvedValueOnce(false);

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "maria@example.com", password: "wrong" });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/Credenciales/);
    });

    it("401 — falla cuando el usuario no existe en la DB", async () => {
        pool.query.mockResolvedValueOnce({ rows: [] }); // usuario no encontrado

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "noexiste@example.com", password: "secret123" });

        expect(res.status).toBe(401);
    });

    it("400 — falla cuando faltan campos requeridos", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "maria@example.com" }); // sin password

        expect(res.status).toBe(400);
    });
});
