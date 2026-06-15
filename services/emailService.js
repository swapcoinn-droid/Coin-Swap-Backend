import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const FROM = process.env.SES_FROM_EMAIL;

// Función de envío de correo — nunca lanza errores, registra en caso de fallo
async function sendEmail({ to, subject, html, text }) {
    if (!FROM) {
        console.warn("[SES] SES_FROM_EMAIL no está configurada, saltando el correo.");
        return;
    }
    try {
        const command = new SendEmailCommand({
            Source: FROM,
            Destination: { ToAddresses: [to] },
            Message: {
                Subject: { Data: subject, Charset: "UTF-8" },
                Body: {
                    Html: { Data: html, Charset: "UTF-8" },
                    Text: { Data: text, Charset: "UTF-8" },
                },
            },
        });
        const result = await ses.send(command);
        console.log(`[SES] Email enviado a ${to} | MessageId: ${result.MessageId}`);
    } catch (error) {
        // El fallo del correo devuelve el estado en el resultado
        console.error("[SES] Falló el envío de correo:", {
            to,
            subject,
            errorCode: error.name,
            message: error.message,
        });
        return { ok: false, error: error.message };
    }
    return { ok: true };
}

// Plantillas de correo

export async function sendDepositEmail({ to, name, amount, currency, newBalance }) {
    const subject = `✅ Depósito recibido: ${amount} ${currency}`;
    const html = `
        <h2>¡Depósito exitoso!</h2>
        <p>Hola <strong>${name}</strong>,</p>
        <p>Se acreditaron <strong>${amount} ${currency}</strong> a tu billetera.</p>
        <p>Nuevo balance: <strong>${newBalance} ${currency}</strong></p>
        <hr/>
        <small>Si no reconoces esta operación, contacta soporte inmediatamente.</small>
    `;
    const text = `Depósito: ${amount} ${currency}. Nuevo balance: ${newBalance} ${currency}.`;
    return await sendEmail({ to, subject, html, text });
}

export async function sendWithdrawEmail({ to, name, amount, currency, newBalance }) {
    const subject = `✅ Retiro realizado: ${amount} ${currency}`;
    const html = `
        <h2>¡Retiro exitoso!</h2>
        <p>Hola <strong>${name}</strong>,</p>
        <p>Se retiraron <strong>${amount} ${currency}</strong> de tu billetera.</p>
        <p>Nuevo balance: <strong>${newBalance} ${currency}</strong></p>
        <hr/>
        <small>Si no reconoces esta operación, contacta soporte inmediatamente.</small>
    `;
    const text = `Retiro: ${amount} ${currency}. Nuevo balance: ${newBalance} ${currency}.`;
    return await sendEmail({ to, subject, html, text });
}

export async function sendExchangeEmail({ to, name, fromAmount, fromCurrency, toAmount, toCurrency, appliedRate }) {
    const subject = `🔄 Conversión: ${fromAmount} ${fromCurrency} → ${toAmount} ${toCurrency}`;
    const html = `
        <h2>¡Conversión exitosa!</h2>
        <p>Hola <strong>${name}</strong>,</p>
        <p>Convertiste <strong>${fromAmount} ${fromCurrency}</strong> a <strong>${toAmount} ${toCurrency}</strong>.</p>
        <p>Tasa aplicada: <strong>${appliedRate}</strong></p>
        <hr/>
        <small>Si no reconoces esta operación, contacta soporte inmediatamente.</small>
    `;
    const text = `Conversión: ${fromAmount} ${fromCurrency} → ${toAmount} ${toCurrency} (tasa: ${appliedRate}).`;
    return await sendEmail({ to, subject, html, text });
}