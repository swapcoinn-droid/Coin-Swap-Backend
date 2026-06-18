/**
 * chat.integration.test.js
 *
 * Prueba el endpoint real de Express:
 *   POST /api/chat
 *
 * La llamada a Gemini API se mockea con vi.mock sobre chatService.js
 * → nunca sale a internet ni requiere GEMINI_API_KEY real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { authHeader } from "./setup.js";

// ─── Mock del chatService ──────────────────────────────────────────────────────
// Mockeamos todo el servicio de chat para evitar la llamada fetch a Gemini.
// Los tests de validación de rutas usan el módulo real (sin mock del servicio),
// ya que la validación ocurre ANTES de llamar al servicio.

vi.mock("../../services/chatService.js", () => ({
    chat: vi.fn(),
}));

import { chat } from "../../services/chatService.js";

// ─── Tests: casos exitosos ────────────────────────────────────────────────────

describe("POST /api/chat — casos exitosos", () => {
    beforeEach(() => vi.clearAllMocks());

    it("200 — devuelve reply y el historial actualizado", async () => {
        chat.mockResolvedValueOnce({
            reply: "¡Hola aventurero! ¿En qué te puedo ayudar?",
            history: [
                { role: "user",  text: "¿Cómo deposito fondos?" },
                { role: "model", text: "¡Hola aventurero! ¿En qué te puedo ayudar?" },
            ],
        });

        const res = await request(app)
            .post("/api/chat")
            .set(authHeader())
            .send({ message: "¿Cómo deposito fondos?" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("reply");
        expect(res.body).toHaveProperty("history");
        expect(typeof res.body.reply).toBe("string");
    });

    it("200 — el historial incluye el mensaje del usuario y la respuesta del modelo", async () => {
        const mockHistory = [
            { role: "user",  text: "¿Cómo deposito?" },
            { role: "model", text: "Podés depositar desde el menú de Wallet." },
        ];
        chat.mockResolvedValueOnce({ reply: "Podés depositar desde el menú de Wallet.", history: mockHistory });

        const res = await request(app)
            .post("/api/chat")
            .set(authHeader())
            .send({ message: "¿Cómo deposito?", history: [] });

        expect(res.status).toBe(200);
        expect(res.body.history).toHaveLength(2);
        expect(res.body.history[0].role).toBe("user");
        expect(res.body.history[1].role).toBe("model");
    });

    it("200 — pasa el historial existente y lo extiende en 2 entradas", async () => {
        const existingHistory = [
            { role: "user",  text: "Hola" },
            { role: "model", text: "¡Hola aventurero!" },
        ];
        const newHistory = [
            ...existingHistory,
            { role: "user",  text: "¿Cómo retiro?" },
            { role: "model", text: "Podés retirar desde Wallet." },
        ];
        chat.mockResolvedValueOnce({ reply: "Podés retirar desde Wallet.", history: newHistory });

        const res = await request(app)
            .post("/api/chat")
            .set(authHeader())
            .send({ message: "¿Cómo retiro?", history: existingHistory });

        expect(res.status).toBe(200);
        expect(res.body.history).toHaveLength(4);
    });

    it("200 — el mensaje llega al servicio con espacios recortados", async () => {
        chat.mockResolvedValueOnce({
            reply: "Respuesta",
            history: [{ role: "user", text: "¿Cómo deposito?" }, { role: "model", text: "Respuesta" }],
        });

        await request(app)
            .post("/api/chat")
            .set(authHeader())
            .send({ message: "   ¿Cómo deposito?   " });

        // Verificar que chatService recibió el mensaje limpio (sin espacios)
        expect(chat).toHaveBeenCalledWith(
            expect.objectContaining({ message: "¿Cómo deposito?" })
        );
    });
});

// ─── Tests: validaciones de entrada ──────────────────────────────────────────

describe("POST /api/chat — validaciones de entrada (middleware de ruta)", () => {
    beforeEach(() => vi.clearAllMocks());

    it("400 — falla cuando el mensaje es un string vacío", async () => {
        const res = await request(app)
            .post("/api/chat")
            .set(authHeader())
            .send({ message: "" });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/requerido/);
        expect(chat).not.toHaveBeenCalled(); // el servicio nunca se llama
    });

    it("400 — falla cuando el mensaje es solo espacios en blanco", async () => {
        const res = await request(app)
            .post("/api/chat")
            .set(authHeader())
            .send({ message: "   " });

        expect(res.status).toBe(400);
        expect(chat).not.toHaveBeenCalled();
    });

    it("400 — falla cuando el mensaje no es string (número)", async () => {
        const res = await request(app)
            .post("/api/chat")
            .set(authHeader())
            .send({ message: 42 });

        expect(res.status).toBe(400);
        expect(chat).not.toHaveBeenCalled();
    });

    it("400 — falla cuando el historial no es un array", async () => {
        const res = await request(app)
            .post("/api/chat")
            .set(authHeader())
            .send({ message: "Hola", history: "invalido" });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/array/);
        expect(chat).not.toHaveBeenCalled();
    });

    it("400 — falla cuando falta el campo message", async () => {
        const res = await request(app)
            .post("/api/chat")
            .set(authHeader())
            .send({});

        expect(res.status).toBe(400);
        expect(chat).not.toHaveBeenCalled();
    });
});

// ─── Tests: autenticación ─────────────────────────────────────────────────────

describe("POST /api/chat — autenticación", () => {
    it("401 — rechaza sin token", async () => {
        const res = await request(app)
            .post("/api/chat")
            .send({ message: "Hola" });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/Token/);
    });

    it("401 — rechaza con token malformado", async () => {
        const res = await request(app)
            .post("/api/chat")
            .set("Authorization", "Bearer token-invalido")
            .send({ message: "Hola" });

        expect(res.status).toBe(401);
    });
});

// ─── Tests: errores del servicio ─────────────────────────────────────────────

describe("POST /api/chat — errores del servicio (chatService)", () => {
    beforeEach(() => vi.clearAllMocks());

    it("503 — devuelve 503 cuando Gemini API falla", async () => {
        const { ServiceError } = await import("../../error/errorHandler.js");
        chat.mockRejectedValueOnce(new ServiceError("No pudimos procesar tu mensaje."));

        const res = await request(app)
            .post("/api/chat")
            .set(authHeader())
            .send({ message: "Hola" });

        expect(res.status).toBe(503);
        expect(res.body).toHaveProperty("error");
    });

    it("503 — devuelve mensaje informativo cuando el servicio no está disponible", async () => {
        const { ServiceError } = await import("../../error/errorHandler.js");
        chat.mockRejectedValueOnce(
            new ServiceError("El servicio de chat no está disponible en este momento")
        );

        const res = await request(app)
            .post("/api/chat")
            .set(authHeader())
            .send({ message: "Hola" });

        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/no está disponible/);
    });
});
