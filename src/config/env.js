/**
 * @file env.js
 * @description Validación centralizada de variables de entorno al arrancar la aplicación.
 * Falla rápido (fail-fast) con mensaje claro si falta alguna variable crítica.
 */

const dotenv = require('dotenv');

// Cargar variables de .env
dotenv.config();

const requiredEnvVars = [
    {
        name: 'MONGO_URI',
        validator: (val) => Boolean(val && val.trim().startsWith('mongodb')),
        message: 'Falta MONGO_URI en .env o el formato no es válido (ej: mongodb://localhost:27017/eduplat).'
    },
    {
        name: 'SESSION_SECRET',
        validator: (val) => Boolean(val && val.length >= 16),
        message: 'Falta SESSION_SECRET en .env o tiene menos de 16 caracteres. Genera uno seguro con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    }
];

function validateEnv() {
    const errors = [];

    for (const rule of requiredEnvVars) {
        const val = process.env[rule.name];
        if (!rule.validator(val)) {
            errors.push(`  - [${rule.name}]: ${rule.message}`);
        }
    }

    if (errors.length > 0) {
        console.error('\n======================================================');
        console.error('❌ ERROR FATAL DE CONFIGURACIÓN DE ENTORNO:');
        console.error(errors.join('\n'));
        console.error('======================================================\n');
        process.exit(1);
    }

    return {
        port: Number(process.env.PORT) || 3000,
        nodeEnv: process.env.NODE_ENV || 'development',
        isProduction: process.env.NODE_ENV === 'production',
        appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, ''),
        mongoUri: process.env.MONGO_URI,
        sessionSecret: process.env.SESSION_SECRET,
        smtp: {
            host: process.env.SMTP_HOST || '',
            port: Number(process.env.SMTP_PORT) || 587,
            email: process.env.SMTP_EMAIL || '',
            password: process.env.SMTP_PASSWORD || '',
            fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@eduplat.com'
        }
    };
}

module.exports = validateEnv();
