/**
 * @file rateLimiters.js
 * @description Limitadores de peticiones para endpoints sensibles (login, registro,
 * recuperación de contraseña y contacto). Los mensajes se muestran en español y,
 * en formularios HTML, se redirige con un flash en lugar de dejar al usuario en un JSON.
 */

const rateLimit = require('express-rate-limit');

/**
 * Crea un limitador con un handler que redirige y muestra un mensaje flash.
 * @param {object} opciones
 * @param {number} opciones.windowMs Ventana de tiempo en milisegundos.
 * @param {number} opciones.limit Número máximo de peticiones por ventana.
 * @param {string} opciones.message Mensaje mostrado al superar el límite.
 * @param {string} opciones.redirectTo Ruta a la que se redirige.
 * @returns {Function} Middleware de Express.
 */
function crearLimitador({ windowMs, limit, message, redirectTo }) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        // Evita que un formulario quede bloqueado sin explicación: flash + 429.
        handler: (req, res) => {
            if (req.flash) {
                req.flash('error_msg', message);
            }
            return res.status(429).redirect(redirectTo);
        }
    });
}

// Login: 10 intentos cada 15 minutos por IP.
const loginLimiter = crearLimitador({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: 'Demasiados intentos de inicio de sesión. Espera 15 minutos e inténtalo de nuevo.',
    redirectTo: '/login'
});

// Registro: 5 cuentas por hora y IP.
const registerLimiter = crearLimitador({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    message: 'Se alcanzó el límite de registros desde esta conexión. Inténtalo más tarde.',
    redirectTo: '/registro'
});

// Solicitudes de recuperación: 5 cada 15 minutos.
const forgotPasswordLimiter = crearLimitador({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: 'Demasiadas solicitudes de recuperación. Espera 15 minutos antes de reintentar.',
    redirectTo: '/olvide-password'
});

// Envío de nueva contraseña: 10 intentos cada 15 minutos.
const resetPasswordLimiter = crearLimitador({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: 'Demasiados intentos para restablecer la contraseña. Solicita un enlace nuevo más tarde.',
    redirectTo: '/olvide-password'
});

// Contacto: 5 mensajes por hora.
const contactLimiter = crearLimitador({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    message: 'Has enviado varios mensajes en poco tiempo. Espera una hora antes de enviar otro.',
    redirectTo: '/contacto'
});

module.exports = {
    loginLimiter,
    registerLimiter,
    forgotPasswordLimiter,
    resetPasswordLimiter,
    contactLimiter
};
