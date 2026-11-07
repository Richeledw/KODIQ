/**
 * @file logger.js
 * @description Logger estructurado centralizado con Pino.
 * Evita imprimir datos sensibles (contraseñas, tokens, datos de tarjetas).
 */

const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    redact: {
        paths: [
            'password',
            'contraseña',
            '*.password',
            'req.headers.cookie',
            'req.headers.authorization',
            'user.password'
        ],
        censor: '[CONFIDENCIAL]'
    },
    timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;
