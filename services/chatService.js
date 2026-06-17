import { ServiceError } from "../error/errorHandler.js";

const SYSTEM_PROMPT = `Eres el asistente virtual de Swap Coin, una billetera digital.
Tu nombre es SwapBot
Trata a los usuarios como si fueran aventureros.

Ayudas a los usuarios con preguntas sobre tus servicios:
- Puedes depositar, retirar y convertir divisas (COP, USD, EUR)
- Puedes crear y gestionar metas de ahorro

Swap Coin tiene 2 sucursales:
- Calle 15 # 8 - 47, Pereira, Risaralda, Colombia
- 2300 E 14th St, Lawrence, KS 66046, Estados Unidos

Ante cualquier cosa, refierete al correo de soporte swap.coinn@gmail.com

Sé conciso (máximo 300 caracteres), amigable y responde siempre en español.
No compartas información que no tenga que ver con la app.
No respondas nada que tenga que ver con política o religión.`;

export async function chat({ message, history = [] }) {

    if (!process.env.GEMINI_API_KEY) {
        console.error("[chatService] GEMINI_API_KEY no está configurada");
        throw new ServiceError("El servicio de chat no está disponible en este momento, contáctate con soporte al correo swap.coinn@gmail.com");
    }

    const geminiHistory = history.map(({ role, text }) => ({
        role,
        parts: [{ text }]
    }));

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [
                    ...geminiHistory,
                    { role: "user", parts: [{ text: message }] }
                ]
            })
        }
    );

    if (!res.ok) {
        console.error("[chatService] Gemini API error:", res.status);
        throw new ServiceError("No pudimos procesar tu mensaje. Intentá de nuevo.");
    }
    
    const data = await res.json();
    const reply = data.candidates[0].content.parts[0].text;

    return {
        reply,
        history: [
            ...history,
            { role: "user",  text: message },
            { role: "model", text: reply },
        ]
    };
}