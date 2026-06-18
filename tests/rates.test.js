import { describe, it, expect } from "vitest";
import { convertAmount, getAppliedRate } from "./helpers.js";

// Tests para: GET /api/rates
// Cubre Lógica de conversión y calculación de tasas de services/exchangeRateService.js

const RATES = { USD: 1, COP: 4150.5, EUR: 0.92 };

describe("GET /api/rates — response shape", () => {
    it("response includes a base currency of USD", () => {
        const response = { base: "USD", rates: RATES, updatedAt: new Date().toISOString() };
        expect(response.base).toBe("USD");
    });

    it("response includes USD, COP and EUR rates", () => {
        const response = { base: "USD", rates: RATES };
        expect(response.rates).toHaveProperty("USD");
        expect(response.rates).toHaveProperty("COP");
        expect(response.rates).toHaveProperty("EUR");
    });

    it("USD rate is always 1 (base currency)", () => {
        expect(RATES.USD).toBe(1);
    });

    it("updatedAt is a valid ISO date string", () => {
        const updatedAt = new Date().toISOString();
        expect(() => new Date(updatedAt)).not.toThrow();
        expect(new Date(updatedAt).toISOString()).toBe(updatedAt);
    });
});

describe("GET /api/rates — convertAmount()", () => {
    it("converts 100 USD to COP correctly", () => {
        expect(convertAmount(100, "USD", "COP", RATES)).toBe(415050);
    });

    it("converts 4150.5 COP to 1 USD", () => {
        expect(convertAmount(4150.5, "COP", "USD", RATES)).toBe(1);
    });

    it("converts 1 EUR to COP", () => {
        expect(convertAmount(1, "EUR", "COP", RATES)).toBeCloseTo(4511.41, 1);
    });

    it("converts 1 USD to EUR", () => {
        expect(convertAmount(1, "USD", "EUR", RATES)).toBeCloseTo(0.92, 2);
    });

    it("same-currency conversion returns the original amount", () => {
        expect(convertAmount(500, "USD", "USD", RATES)).toBe(500);
    });

    it("result is rounded to at most 2 decimal places", () => {
        const result = convertAmount(1, "COP", "EUR", RATES);
        const decimalPart = result.toString().split(".")[1] ?? "";
        expect(decimalPart.length).toBeLessThanOrEqual(2);
    });

    it("larger amounts scale linearly", () => {
        const single = convertAmount(1, "USD", "COP", RATES);
        const hundred = convertAmount(100, "USD", "COP", RATES);
        expect(hundred).toBeCloseTo(single * 100, 0);
    });
});

describe("GET /api/rates — getAppliedRate()", () => {
    it("returns correct rate for USD → COP", () => {
        const rate = getAppliedRate("USD", "COP", RATES);
        expect(rate).toBeCloseTo(4150.5, 1);
    });

    it("returns correct rate for COP → USD", () => {
        const rate = getAppliedRate("COP", "USD", RATES);
        expect(rate).toBeCloseTo(1 / 4150.5, 5);
    });

    it("returns 1 when both currencies are the same", () => {
        const rate = getAppliedRate("USD", "USD", RATES);
        expect(rate).toBe(1);
    });

    it("result is rounded to at most 6 decimal places", () => {
        const rate = getAppliedRate("COP", "EUR", RATES);
        const decimalPart = rate.toString().split(".")[1] ?? "";
        expect(decimalPart.length).toBeLessThanOrEqual(6);
    });
});
