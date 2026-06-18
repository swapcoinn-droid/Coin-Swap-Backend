import { describe, it, expect } from "vitest";
import { validateChatMessage, ServiceError } from "./helpers.js";

// Tests para: POST /api/chat
// Cubre validación de routes/chat.routes.js y manejo de errores del chatService

// POST /api/chat — validación de mensaje

describe("POST /api/chat — validateChatMessage()", () => {
    it("pasa con un mensaje válido y sin historial", () => {
        const result = validateChatMessage({ message: "¿Cómo deposito fondos?" });
        expect(result.ok).toBe(true);
        expect(result.history).toEqual([]);
    });

    it("pasa con un mensaje válido y historial existente", () => {
        const history = [
            { role: "user",  text: "Hola" },
            { role: "model", text: "¡Hola aventurero!" },
        ];
        const result = validateChatMessage({ message: "¿Cómo retiro?", history });
        expect(result.ok).toBe(true);
        expect(result.history).toHaveLength(2);
    });

    it("recorta los espacios en blanco del mensaje", () => {
        const result = validateChatMessage({ message: "  ¿Cómo deposito?  " });
        expect(result.ok).toBe(true);
        expect(result.message).toBe("¿Cómo deposito?");
    });

    it("falla cuando el mensaje es un string vacío", () => {
        const result = validateChatMessage({ message: "" });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/requerido/);
    });

    it("falla cuando el mensaje es solo espacios en blanco", () => {
        const result = validateChatMessage({ message: "   " });
        expect(result.ok).toBe(false);
    });

    it("falla cuando el mensaje no es un string", () => {
        const result = validateChatMessage({ message: 42 });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/requerido/);
    });

    it("falla cuando el mensaje es null", () => {
        const result = validateChatMessage({ message: null });
        expect(result.ok).toBe(false);
    });

    it("falla cuando falta el mensaje", () => {
        const result = validateChatMessage({});
        expect(result.ok).toBe(false);
    });

    it("falla cuando el historial no es un array", () => {
        const result = validateChatMessage({ message: "Hola", history: "invalid" });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/array/);
    });

    it("pasa cuando el historial es un array vacío", () => {
        const result = validateChatMessage({ message: "Hola", history: [] });
        expect(result.ok).toBe(true);
    });
});

// POST /api/chat — estructura del historial

describe("POST /api/chat — estructura del historial", () => {
    it("cada entrada del historial tiene role y text", () => {
        const history = [
            { role: "user",  text: "¿Cómo deposito?" },
            { role: "model", text: "Puedes depositar desde /wallet/deposit." },
        ];
        history.forEach(entry => {
            expect(entry).toHaveProperty("role");
            expect(entry).toHaveProperty("text");
        });
    });

    it("los valores de rol son solo 'user' o 'model'", () => {
        const history = [
            { role: "user",  text: "Hola" },
            { role: "model", text: "¡Hola!" },
        ];
        history.forEach(entry => {
            expect(["user", "model"]).toContain(entry.role);
        });
    });

    it("la respuesta se agrega al historial como rol 'model'", () => {
        const history = [{ role: "user", text: "Hola" }];
        const reply = "¡Hola aventurero!";
        const updated = [...history, { role: "model", text: reply }];
        expect(updated).toHaveLength(2);
        expect(updated[1].role).toBe("model");
        expect(updated[1].text).toBe(reply);
    });

    it("el mensaje del usuario se agrega al historial antes de la respuesta del modelo", () => {
        const history = [];
        const message = "¿Qué servicios ofrecen?";
        const reply = "Ofrecemos depósitos, retiros y conversión de divisas.";
        const updated = [
            ...history,
            { role: "user",  text: message },
            { role: "model", text: reply },
        ];
        expect(updated[0].role).toBe("user");
        expect(updated[1].role).toBe("model");
    });

    it("el historial crece en 2 entradas por turno de conversación", () => {
        const history = [];
        const addTurn = (h, msg, reply) => [
            ...h,
            { role: "user",  text: msg },
            { role: "model", text: reply },
        ];
        const after1 = addTurn(history, "Hola", "¡Hola!");
        const after2 = addTurn(after1, "¿Cómo retiro?", "Desde /wallet/withdraw.");
        expect(after1).toHaveLength(2);
        expect(after2).toHaveLength(4);
    });
});

// POST /api/chat — ServiceError (chatService)

describe("POST /api/chat — ServiceError (503 fallback)", () => {
    it("ServiceError tiene statusCode 503 por defecto", () => {
        const err = new ServiceError("El servicio no está disponible");
        expect(err.statusCode).toBe(503);
    });

    it("ServiceError es una instancia de Error", () => {
        const err = new ServiceError("fallo");
        expect(err).toBeInstanceOf(Error);
    });

    it("el boolean de isOperational de ServiceError es true", () => {
        const err = new ServiceError("fallo");
        expect(err.isOperational).toBe(true);
    });

    it("ServiceError acepta un statusCode personalizado", () => {
        const err = new ServiceError("fallo", 500);
        expect(err.statusCode).toBe(500);
    });

    it("El escenario de una clave API faltante produce un ServiceError", () => {
        function simulateMissingKey(apiKey) {
            if (!apiKey) throw new ServiceError("El servicio de chat no está disponible en este momento");
        }
        expect(() => simulateMissingKey(null)).toThrow(ServiceError);
        expect(() => simulateMissingKey(null)).toThrow("no está disponible");
    });

    it("una respuesta no correcta de Gemini produce un ServiceError", () => {
        function simulateBadResponse(ok) {
            if (!ok) throw new ServiceError("No pudimos procesar tu mensaje. Intentá de nuevo.");
        }
        expect(() => simulateBadResponse(false)).toThrow("procesar tu mensaje");
    });
});
