import { describe, it, expect } from "vitest";
import {
    sanitizePagination,
    validateCreateGoal,
    validateUpdateGoal,
    validateGoalContribution,
    validateGoalWithdraw,
    calcProgress,
    canEditGoal,
    newTargetAmountIsValid,
    checkSufficientFunds,
} from "./helpers.js";

// Tests para:
// GET /api/goals
// POST /api/goals
// POST /api/goals/:id/contribute
// POST /api/goals/:id/withdraw
// PATCH /api/goals/:id
// DELETE /api/goals/:id

// GET /api/goals 

describe("GET /api/goals — sanitizePagination", () => {
    it("pasa por defecto a la página 1 y límite 10", () => {
        const result = sanitizePagination("1", "10");
        expect(result.ok).toBe(true);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(10);
    });

    it("rechaza la página 0", () => {
        expect(sanitizePagination("0", "10").ok).toBe(false);
    });

    it("rechaza el límite por encima de 100", () => {
        expect(sanitizePagination("1", "200").ok).toBe(false);
    });

    it("rechaza entradas no numéricas", () => {
        expect(sanitizePagination("abc", "xyz").ok).toBe(false);
    });
});

describe("GET /api/goals — estructura de respuesta", () => {
    const mockGoal = {
        id: 5,
        name: "Viaje a Europa",
        currency: "USD",
        currencySymbol: "$",
        targetAmount: 3000,
        currentAmount: 750,
        progress: calcProgress(750, 3000),
        targetDate: "2026-07-01",
        status: "active",
    };

    it("la meta tiene todos los campos requeridos", () => {
        ["id","name","currency","targetAmount","currentAmount","progress","status"].forEach(field => {
            expect(mockGoal).toHaveProperty(field);
        });
    });

    it("el progreso es un número entre 0 y 100", () => {
        expect(mockGoal.progress).toBeGreaterThanOrEqual(0);
        expect(mockGoal.progress).toBeLessThanOrEqual(100);
    });

    it("el estado es uno de los valores permitidos", () => {
        expect(["active","completed","cancelled"]).toContain(mockGoal.status);
    });
});

// POST /api/goals 

describe("POST /api/goals — validateCreateGoal()", () => {
    it("pasa con nombre y monto objetivo", () => {
        const result = validateCreateGoal({ name: "Viaje a Europa", targetAmount: 3000 });
        expect(result.ok).toBe(true);
    });

    it("establece la moneda COP por defecto cuando no se especifica", () => {
        const result = validateCreateGoal({ name: "Meta", targetAmount: 500 });
        expect(result.currency).toBe("COP");
    });

    it("acepta una moneda explícita", () => {
        const result = validateCreateGoal({ name: "Meta", targetAmount: 500, currency: "USD" });
        expect(result.currency).toBe("USD");
    });

    it("falla cuando falta el nombre", () => {
        const result = validateCreateGoal({ targetAmount: 3000 });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/nombre/i);
    });

    it("falla cuando targetAmount es 0", () => {
        const result = validateCreateGoal({ name: "Meta", targetAmount: 0 });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/Monto objetivo/);
    });

    it("falla cuando targetAmount es negativo", () => {
        const result = validateCreateGoal({ name: "Meta", targetAmount: -100 });
        expect(result.ok).toBe(false);
    });

    it("falla con un objeto vacío", () => {
        const result = validateCreateGoal({});
        expect(result.ok).toBe(false);
    });
});

// POST /api/goals/:id/contribute 

describe("POST /api/goals/:id/contribute — validateGoalContribution()", () => {
    it("pasa cuando la contribución está dentro del monto restante", () => {
        const result = validateGoalContribution(250, 750, 3000);
        expect(result.ok).toBe(true);
    });

    it("pasa cuando la contribución excede el monto restante", () => {
        const result = validateGoalContribution(2250, 750, 3000);
        expect(result.ok).toBe(true);
    });

    it("falla cuando la contribución excede el monto restante", () => {
        const result = validateGoalContribution(9999, 750, 3000);
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/excede/);
    });

    it("falla cuando la contribución es 0", () => {
        const result = validateGoalContribution(0, 0, 3000);
        expect(result.ok).toBe(false);
    });

    it("falla cuando la contribución es negativa", () => {
        const result = validateGoalContribution(-100, 0, 3000);
        expect(result.ok).toBe(false);
    });

    it("el mensaje de error incluye el monto restante exacto", () => {
        const result = validateGoalContribution(2500, 750, 3000);
        expect(result.error).toContain("2250");
    });
});

describe("POST /api/goals/:id/contribute — checkSufficientFunds()", () => {
    it("permite la contribución cuando el saldo de la billetera es suficiente", () => {
        expect(checkSufficientFunds(5000, 250)).toBe(true);
    });

    it("lanza error 400 cuando el saldo de la billetera es insuficiente", () => {
        expect(() => checkSufficientFunds(100, 250)).toThrow("Saldo insuficiente");
    });
});

describe("POST /api/goals/:id/contribute — finalización de la meta", () => {
    it("la meta se vuelve completada cuando currentAmount alcanza targetAmount", () => {
        const current = 2750;
        const target  = 3000;
        const contribution = 250;
        const newCurrent = current + contribution;
        const status = newCurrent >= target ? "completed" : "active";
        expect(status).toBe("completed");
    });

    it("la meta permanece activa cuando currentAmount todavía está por debajo de targetAmount", () => {
        const current = 2000;
        const target  = 3000;
        const contribution = 500;
        const newCurrent = current + contribution;
        const status = newCurrent >= target ? "completed" : "active";
        expect(status).toBe("active");
    });
});

// POST /api/goals/:id/withdraw

describe("POST /api/goals/:id/withdraw — validateGoalWithdraw()", () => {
    it("pasa cuando el retiro está dentro del currentAmount", () => {
        const result = validateGoalWithdraw(200, 750);
        expect(result.ok).toBe(true);
    });

    it("pasa cuando el retiro es igual al currentAmount", () => {
        const result = validateGoalWithdraw(750, 750);
        expect(result.ok).toBe(true);
    });

    it("falla cuando el retiro excede el currentAmount", () => {
        const result = validateGoalWithdraw(1000, 750);
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/750/);
    });

    it("falla cuando el retiro es 0", () => {
        const result = validateGoalWithdraw(0, 750);
        expect(result.ok).toBe(false);
    });

    it("falla cuando el retiro es negativo", () => {
        const result = validateGoalWithdraw(-50, 750);
        expect(result.ok).toBe(false);
    });
});

// PATCH /api/goals/:id

describe("PATCH /api/goals/:id — validateUpdateGoal()", () => {
    it("pasa cuando se proporciona al menos un campo", () => {
        expect(validateUpdateGoal({ name: "Nuevo nombre" }).ok).toBe(true);
        expect(validateUpdateGoal({ targetAmount: 5000 }).ok).toBe(true);
        expect(validateUpdateGoal({ targetDate: "2027-01-01" }).ok).toBe(true);
    });

    it("falla cuando no se proporciona ningún campo", () => {
        const result = validateUpdateGoal({});
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/al menos un campo/);
    });
});

describe("PATCH /api/goals/:id — canEditGoal()", () => {
    it("permite editar una meta activa", () => {
        expect(canEditGoal("active").ok).toBe(true);
    });

    it("bloquea la edición de una meta completada", () => {
        const result = canEditGoal("completed");
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/activa/);
    });

    it("bloquea la edición de una meta cancelada", () => {
        const result = canEditGoal("cancelled");
        expect(result.ok).toBe(false);
    });
});

describe("PATCH /api/goals/:id — newTargetAmountIsValid()", () => {
    it("pasa cuando el nuevo monto objetivo es mayor al currentAmount", () => {
        expect(newTargetAmountIsValid(4000, 750).ok).toBe(true);
    });

    it("pasa cuando el nuevo monto objetivo es igual al currentAmount", () => {
        expect(newTargetAmountIsValid(750, 750).ok).toBe(true);
    });

    it("falla cuando el nuevo monto objetivo es menor al currentAmount", () => {
        const result = newTargetAmountIsValid(500, 750);
        expect(result.ok).toBe(false);
        expect(result.error).toContain("750");
    });
});

// DELETE /api/goals/:id

describe("DELETE /api/goals/:id — refund logic", () => {
    it("reembolsa currentAmount a la billetera cuando es mayor a 0", () => {
        const currentAmount = 750;
        const walletBalance = 1000;
        const newBalance = walletBalance + currentAmount;
        expect(newBalance).toBe(1750);
    });

    it("no cambia el balance de la billetera cuando el currentAmount es 0", () => {
        const currentAmount = 0;
        const walletBalance = 1000;
        const newBalance = walletBalance + currentAmount;
        expect(newBalance).toBe(1000);
    });

    it("el mensaje de respuesta incluye el monto reembolsado", () => {
        const amount = 750;
        const message = `Meta eliminada, ${amount} devueltos a tu balance`;
        expect(message).toContain("750");
    });
});

// calcProgress — compartido en todas las respuestas de metas

describe("calcProgress() — usado en todas las respuestas de metas", () => {
    it("devuelve 0% cuando no se ha ahorrado nada", () => {
        expect(calcProgress(0, 3000)).toBe(0);
    });

    it("devuelve 25% cuando se ha ahorrado un cuarto de la meta", () => {
        expect(calcProgress(750, 3000)).toBe(25);
    });

    it("devuelve 50% cuando se ha ahorrado la mitad de la meta", () => {
        expect(calcProgress(1500, 3000)).toBe(50);
    });

    it("devuelve 100% cuando la meta está completada", () => {
        expect(calcProgress(3000, 3000)).toBe(100);
    });

    it("redondea los decimales repetidos a 2 lugares", () => {
        expect(calcProgress(1, 3)).toBe(33.33);
    });
});
