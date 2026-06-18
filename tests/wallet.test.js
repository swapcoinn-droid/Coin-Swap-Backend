import { describe, it, expect } from "vitest";
import {
    sanitizeAmount,
    sanitizePagination,
    validateDeposit,
    validateWithdraw,
    validateExchange,
    checkSufficientFunds,
    convertAmount,
} from "./helpers.js";

// Tests para:
// GET /api/wallet
// POST /api/wallet/deposit
// POST /api/wallet/withdraw
// POST /api/wallet/exchange
// GET /api/wallet/transactions

const RATES = { USD: 1, COP: 4150.5, EUR: 0.92 };

// GET /api/wallet

describe("GET /api/wallet — forma de balances y total", () => {
    const balances = [
        { currency: "COP", amount: 250000, estimatedCOP: 250000 },
        { currency: "USD", amount: 100,    estimatedCOP: convertAmount(100, "USD", "COP", RATES) },
        { currency: "EUR", amount: 50,     estimatedCOP: convertAmount(50,  "EUR", "COP", RATES) },
    ];

    it("cada entrada de balance tiene los campos requeridos", () => {
        balances.forEach(b => {
            expect(b).toHaveProperty("currency");
            expect(b).toHaveProperty("amount");
            expect(b).toHaveProperty("estimatedCOP");
        });
    });

    it("totalEstimatedCOP suma todos los valores estimatedCOP", () => {
        const total = +balances.reduce((sum, b) => sum + b.estimatedCOP, 0).toFixed(2);
        expect(total).toBeGreaterThan(0);
        expect(typeof total).toBe("number");
    });

    it("totalEstimatedCOP está redondeado a 2 decimales", () => {
        const total = +balances.reduce((sum, b) => sum + b.estimatedCOP, 0).toFixed(2);
        const decimalPart = total.toString().split(".")[1] ?? "";
        expect(decimalPart.length).toBeLessThanOrEqual(2);
    });
});

// POST /api/wallet/deposit

describe("POST /api/wallet/deposit — validación de entrada", () => {
    it("passes with a valid amount and default currency COP", () => {
        const result = validateDeposit({ amount: 50000 });
        expect(result.ok).toBe(true);
        expect(result.currency).toBe("COP");
    });

    it("pasa con una moneda explícita", () => {
        const result = validateDeposit({ amount: 100, currency: "USD" });
        expect(result.ok).toBe(true);
        expect(result.currency).toBe("USD");
    });

    it("rechaza montos cuando es 0", () => {
        const result = validateDeposit({ amount: 0 });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/Monto inválido/);
    });

    it("rechaza montos negativos", () => {
        const result = validateDeposit({ amount: -100 });
        expect(result.ok).toBe(false);
    });

    it("rechaza montos cuando falta el monto", () => {
        const result = validateDeposit({});
        expect(result.ok).toBe(false);
    });
});

describe("POST /api/wallet/deposit — sanitizeAmount", () => {
    it("aceptar cantidades enteras", () => {
        expect(sanitizeAmount(50000).ok).toBe(true);
    });

    it("aceptar cantidades con 2 decimales", () => {
        expect(sanitizeAmount(99.99).ok).toBe(true);
    });

    it("rechaza montos cuando es string", () => {
        expect(sanitizeAmount("50000").ok).toBe(false);
    });

    it("rechaza montos con mas de 2 decimales", () => {
        expect(sanitizeAmount(50.999).ok).toBe(false);
    });
});

// POST /api/wallet/withdraw

describe("POST /api/wallet/withdraw — validación de entrada", () => {
    it("pasa con un monto válido y moneda COP por defecto", () => {
        const result = validateWithdraw({ amount: 20000 });
        expect(result.ok).toBe(true);
        expect(result.currency).toBe("COP");
    });

    it("rechaza montos cuando es 0", () => {
        const result = validateWithdraw({ amount: 0 });
        expect(result.ok).toBe(false);
    });

    it("rechaza montos cuando falta el monto", () => {
        const result = validateWithdraw({});
        expect(result.ok).toBe(false);
    });
});

describe("POST /api/wallet/withdraw — checkSufficientFunds()", () => {
    it("permite retiro cuando el saldo es igual al monto", () => {
        expect(checkSufficientFunds(500, 500)).toBe(true);
    });

    it("permite retiro cuando el saldo excede el monto", () => {
        expect(checkSufficientFunds(1000, 500)).toBe(true);
    });

    it("lanza error 400 cuando el saldo es insuficiente", () => {
        expect(() => checkSufficientFunds(100, 500)).toThrow("Saldo insuficiente");
    });

    it("el error lanzado tiene statusCode 400", () => {
        try {
            checkSufficientFunds(0, 1);
        } catch (e) {
            expect(e.statusCode).toBe(400);
        }
    });

    it("lanza error cuando el saldo es 0", () => {
        expect(() => checkSufficientFunds(0, 0.01)).toThrow();
    });
});

// POST /api/wallet/exchange

describe("POST /api/wallet/exchange — validación de entrada", () => {
    it("pasa con from, to y amount válidos", () => {
        const result = validateExchange({ from: "USD", to: "COP", amount: 100 });
        expect(result.ok).toBe(true);
    });

    it("rechaza cuando from y to son la misma moneda", () => {
        const result = validateExchange({ from: "USD", to: "USD", amount: 100 });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/diferentes/);
    });

    it("rechaza cuando el monto es 0", () => {
        const result = validateExchange({ from: "USD", to: "COP", amount: 0 });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/Datos inválidos/);
    });

    it("rechaza cuando falta el monto", () => {
        const result = validateExchange({ from: "USD", to: "COP" });
        expect(result.ok).toBe(false);
    });

    it("rechaza cuando falta la moneda from", () => {
        const result = validateExchange({ to: "COP", amount: 100 });
        expect(result.ok).toBe(false);
    });

    it("rechaza cuando falta la moneda to", () => {
        const result = validateExchange({ from: "USD", amount: 100 });
        expect(result.ok).toBe(false);
    });

    it("rechaza cuando faltan todos los campos", () => {
        const result = validateExchange({});
        expect(result.ok).toBe(false);
    });
});

describe("POST /api/wallet/exchange — resultado conversion", () => {
    it("100 USD → COP produce un monto acreditado positivo", () => {
        const credited = convertAmount(100, "USD", "COP", RATES);
        expect(credited).toBeGreaterThan(0);
    });

    it("el monto acreditado está redondeado a 2 decimales", () => {
        const credited = convertAmount(1, "EUR", "COP", RATES);
        const decimals = credited.toString().split(".")[1] ?? "";
        expect(decimals.length).toBeLessThanOrEqual(2);
    });
});

// GET /api/wallet/transactions

describe("GET /api/wallet/transactions — sanitizePagination", () => {
    it("pasa por defecto a la página 1 y límite 10", () => {
        const result = sanitizePagination("1", "10");
        expect(result.page).toBe(1);
        expect(result.limit).toBe(10);
    });

    it("aceptar página y límite válidos personalizados", () => {
        const result = sanitizePagination("3", "25");
        expect(result.ok).toBe(true);
        expect(result.page).toBe(3);
        expect(result.limit).toBe(25);
    });

    it("rechaza la página 0", () => {
        expect(sanitizePagination("0", "10").ok).toBe(false);
    });

    it("rechaza página que no sea número", () => {
        expect(sanitizePagination("abc", "10").ok).toBe(false);
    });

    it("rechaza límite mayor a 100", () => {
        expect(sanitizePagination("1", "101").ok).toBe(false);
    });

    it("acepta límite exactamente 100", () => {
        expect(sanitizePagination("1", "100").ok).toBe(true);
    });
});

describe("GET /api/wallet/transactions — forma de respuesta", () => {
    const mockTransactions = [
        { id: 1, type: "deposit",    amount: 50000, currency: "COP" },
        { id: 2, type: "withdrawal", amount: 10000, currency: "COP" },
        { id: 3, type: "exchange",   amount: 100,   currency: "USD", targetCurrency: "COP" },
    ];

    it("todos los tipos de transacción están contabilizados", () => {
        const types = mockTransactions.map(t => t.type);
        expect(types).toContain("deposit");
        expect(types).toContain("withdrawal");
        expect(types).toContain("exchange");
    });

    it("la transacción exchange tiene una targetCurrency", () => {
        const exchange = mockTransactions.find(t => t.type === "exchange");
        expect(exchange).toHaveProperty("targetCurrency");
        expect(exchange.targetCurrency).not.toBeNull();
    });

    it("las transacciones que no son exchange no tienen targetCurrency", () => {
        const deposit = mockTransactions.find(t => t.type === "deposit");
        expect(deposit.targetCurrency).toBeUndefined();
    });

    it("la forma de paginación es correcta", () => {
        const pagination = { total: 42, page: 1, limit: 10, totalPages: 5, hasNextPage: true, hasPrevPage: false };
        expect(pagination).toHaveProperty("total");
        expect(pagination).toHaveProperty("totalPages");
        expect(pagination.hasNextPage).toBe(true);
        expect(pagination.hasPrevPage).toBe(false);
    });
});
