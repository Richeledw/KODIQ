const nodemailer = require('nodemailer');

/**
 * @function sendEmail
 * @async
 * @description Crea una conexión con el servidor SMTP y envía un correo electrónico.
 * Compatible con Gmail (App Passwords), Mailtrap, Ethereal o SMTP personalizado.
 * @param {object} options - Opciones de envío.
 * @param {string} options.email - Destinatario del correo.
 * @param {string} options.subject - Asunto del correo.
 * @param {string} options.message - Mensaje en formato texto plano.
 * @param {string} options.html - Mensaje en formato HTML para mejor diseño visual.
 * @returns {Promise<{success: boolean, previewUrl?: string, error?: string}>}
 */
const sendEmail = async (options) => {
    // En entorno de tests evitamos conexiones de red a Ethereal o servidores SMTP externos
    if (process.env.NODE_ENV === 'test') {
        return { success: true, previewUrl: 'http://test-email.local/preview' };
    }

    try {
        const host = (process.env.SMTP_HOST || '').trim().toLowerCase();
        const user = (process.env.SMTP_EMAIL || '').trim();
        const pass = (process.env.SMTP_PASSWORD || '').trim();
        const port = Number(process.env.SMTP_PORT) || 587;
        const fromEmail = process.env.SMTP_FROM_EMAIL || user || 'noreply@eduplat.com';

        // Detectar si las credenciales son de prueba/falsas
        const isPlaceholder = !user || user.includes('tu_usuario') || !pass || pass.includes('tu_password');

        let transporter;

        if (isPlaceholder) {
            console.warn(
                '[EMAIL WARNING]: Credenciales SMTP sin configurar en .env (detectado placeholder). Generando cuenta de pruebas en Ethereal...'
            );
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
        } else if (host.includes('gmail') || user.endsWith('@gmail.com')) {
            // Configuración optimizada para Gmail
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: user,
                    pass: pass // Contraseña de aplicación de 16 caracteres de Google
                }
            });
        } else {
            // SMTP genérico (Mailtrap, SendGrid, Amazon SES, etc.)
            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: port,
                secure: port === 465,
                auth: {
                    user: user,
                    pass: pass
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
        }

        // Especificamos el contenido y los metadatos del correo electrónico
        const info = await transporter.sendMail({
            from: `"Eduplat Team" <${fromEmail}>`,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html
        });

        console.log(`[EMAIL ENVIADO]: Para: ${options.email} | MessageId: ${info.messageId}`);

        let previewUrl = null;
        if (isPlaceholder) {
            previewUrl = nodemailer.getTestMessageUrl(info);
            console.log(`[ETHEREAL PREVIEW LINK]: ${previewUrl}`);
        }

        return { success: true, messageId: info.messageId, previewUrl };
    } catch (error) {
        console.error('[EMAIL ERROR]: Error al intentar enviar el email:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = sendEmail;
