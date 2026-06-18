import { describe, it, expect } from "vitest";
import {
    validateRegister,
    validateLogin,
    createError,
    conflict,
    unauthorized,
} from "./helpers.js";

// Tests para: POST /api/auth/register  &  POST /api/auth/login
// Cubre middleware/auth.validate.js + fabrica de errorHandler usada en authService

describe("POST /api/auth/register", () => {
    it("pasa con todos los campos requeridos", () => {
        const result = validateRegister({ name: "María García", email: "maria@example.com", password: "secret123" });
        expect(result.ok).toBe(true);
    });

    it("falla cuando falta el nombre", () => {
        const result = validateRegister({ email: "maria@example.com", password: "secret123" });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/requeridos/);
    });

    it("falla cuando falta el email", () => {
        const result = validateRegister({ name: "María", password: "secret123" });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/requeridos/);
    });

    it("falla cuando falta la contraseña", () => {
        const result = validateRegister({ name: "María", email: "maria@example.com" });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/requeridos/);
    });

    it("falla cuando la contraseña es menor a 6 caracteres", () => {
        const result = validateRegister({ name: "María", email: "maria@example.com", password: "abc" });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/6 caracteres/);
    });

    it("pasa con contraseña de exactamente 6 caracteres", () => {
        const result = validateRegister({ name: "María", email: "maria@example.com", password: "abcdef" });
        expect(result.ok).toBe(true);
    });

    it("falla cuando se llama con un objeto vacío", () => {
        const result = validateRegister({});
        expect(result.ok).toBe(false);
    });

    it("produce un error de conflicto 409 para email duplicado (usersService)", () => {
        const err = conflict("El email ya está en uso");
        expect(err.statusCode).toBe(409);
        expect(err.message).toMatch(/email/);
    });
});

describe("POST /api/auth/login", () => {
    it("pasa con email y contraseña", () => {
        const result = validateLogin({ email: "maria@example.com", password: "secret123" });
        expect(result.ok).toBe(true);
    });

    it("falla cuando falta el email", () => {
        const result = validateLogin({ password: "secret123" });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/requeridos/);
    });

    it("falla cuando falta la contraseña", () => {
        const result = validateLogin({ email: "maria@example.com" });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/requeridos/);
    });

    it("falla cuando se llama con un objeto vacío", () => {
        const result = validateLogin({});
        expect(result.ok).toBe(false);
    });

    it("produce un error de no autorizado 401 para credenciales inválidas (authService)", () => {
        const err = unauthorized("Credenciales inválidas");
        expect(err.statusCode).toBe(401);
        expect(err.message).toMatch(/Credenciales/);
    });

    it("el error por credenciales inválidas es una instancia de Error", () => {
        const err = unauthorized("Credenciales inválidas");
        expect(err).toBeInstanceOf(Error);
    });
});
