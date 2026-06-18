// Prueba el endpoint real de Express: GET /api/rates
// La llamada a exchangerate-api.com se mockea con vi.mock → nunca sale a internet. */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";

// ─── Mock del servicio de tasas ────────────────────────────────────────────────
// Mockeamos el servicio directamente en lugar de `fetch` global,
// lo que evita el problema del cache interno del módulo.

vi.mock("../../services/exchangeRateService.js", () => ({
    getRates: vi.fn(),
    convert:  vi.fn(),
}));

import { getRates } from "../../services/exchangeRateService.js";

const FAKE_RATES = { USD: 1, COP: 4150.5, EUR: 0.92 };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/rates", () => {
    beforeEach(() => vi.clearAllMocks());

    it("200 — responde con base USD y los rates COP, EUR, USD", async () => {
        getRates.mockResolvedValue(FAKE_RATES);

        const res = await request(app).get("/api/rates");

        expect(res.status).toBe(200);
        expect(res.body.base).toBe("USD");
        expect(res.body.rates).toHaveProperty("USD", 1);
        expect(res.body.rates).toHaveProperty("COP", 4150.5);
        expect(res.body.rates).toHaveProperty("EUR", 0.92);
    });

    it("200 — la respuesta incluye un campo updatedAt en formato ISO válido", async () => {
        getRates.mockResolvedValue(FAKE_RATES);

        const res = await request(app).get("/api/rates");

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("updatedAt");
        expect(() => new Date(res.body.updatedAt)).not.toThrow();
        expect(new Date(res.body.updatedAt).toISOString()).toBe(res.body.updatedAt);
    });

    it("200 — el rate de USD siempre es 1 (moneda base)", async () => {
        getRates.mockResolvedValue(FAKE_RATES);

        const res = await request(app).get("/api/rates");

        expect(res.body.rates.USD).toBe(1);
    });

    it("200 — los rates son valores numéricos positivos", async () => {
        getRates.mockResolvedValue(FAKE_RATES);

        const res = await request(app).get("/api/rates");

        Object.values(res.body.rates).forEach(rate => {
            expect(typeof rate).toBe("number");
            expect(rate).toBeGreaterThan(0);
        });
    });

    it("500 — propaga el error cuando el servicio de tasas falla", async () => {
        getRates.mockRejectedValue(new Error("Exchange rate API error"));

        const res = await request(app).get("/api/rates");

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
    });
});
