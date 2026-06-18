// Utilidades compartidas para los tests de integración

import jwt from "jsonwebtoken";

// Usamos un secreto fijo para tests (no importa el valor, nunca sale de aquí)
const TEST_SECRET = "test-secret-key";
process.env.JWT_SECRET = TEST_SECRET;
process.env.NODE_ENV   = "test";

// ID de usuario falso que usaremos en todos los tests autenticados.
export const FAKE_USER = { id: 99, email: "test@swap.com", name: "Test User" };

// Genera un JWT firmado con el secreto de test.
export function makeToken(payload = FAKE_USER) {
    return jwt.sign(payload, TEST_SECRET, { expiresIn: "1h" });
}

// Devuelve el objeto de headers con el Bearer token listo.
export function authHeader(payload = FAKE_USER) {
    return { Authorization: `Bearer ${makeToken(payload)}` };
}
