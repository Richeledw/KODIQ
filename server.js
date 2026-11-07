/**
 * @file server.js
 * @description Punto de entrada principal para el servidor de Eduplat.
 * Inicializa la aplicación Express, configura middlewares globales (sesiones, passport, recursos estáticos,
 * seguridad, compresión, logging) y registra las rutas modulares de la arquitectura MVC.
 */

const express = require('express');
const path = require('path');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const flash = require('connect-flash');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');

// Validación temprana de variables de entorno (fail-fast)
const env = require('./src/config/env');
const logger = require('./src/utils/logger');
const connectDB = require('./src/config/db');

// Inicializar la aplicación Express
const app = express();
const PORT = env.port;
const isProduction = env.isProduction;

// Detrás de un proxy de despliegue confiamos en el primer salto para cookies secure e IP real.
if (isProduction) {
    app.set('trust proxy', 1);
}

// Cabeceras HTTP seguras
// TODO(seguridad): migrar los scripts inline restantes y usar nonces para eliminar 'unsafe-inline'.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
            styleSrcAttr: ["'unsafe-inline'"],
            fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
            mediaSrc: ["'self'", 'https:'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            workerSrc: ["'self'", 'blob:'],
            manifestSrc: ["'self'"],
            upgradeInsecureRequests: isProduction ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false
}));

// Comprimir respuestas de texto para optimizar ancho de banda
app.use(compression());

// Configurar estrategias de Passport para el manejo de sesiones de usuario
require('./src/config/passport')(passport);

// Establecer la conexión con MongoDB
connectDB();

// Configuración del motor de vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Servir archivos estáticos desde /public con cabeceras nosniff, caché optimizado y aislamiento CSP para /uploads
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: isProduction ? '7d' : 0,
    setHeaders: (res, filePath) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (filePath.endsWith('.svg')) {
            res.type('image/svg+xml');
        }
        if (filePath.endsWith('.webmanifest')) {
            res.type('application/manifest+json');
        }
        if (filePath.includes(`${path.sep}uploads${path.sep}`)) {
            res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
            res.setHeader('Cache-Control', 'no-store, max-age=0');
        }
    }
}));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sanitización contra inyecciones NoSQL
app.use(mongoSanitize({ replaceWith: '_' }));

// Configuración de Sesiones con almacenamiento persistente en MongoDB
app.use(session({
    name: 'eduplat.sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: env.mongoUri }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction
    }
}));

// Inicializar Passport y conectar con la sesión
app.use(passport.initialize());
app.use(passport.session());

// Habilitar mensajes flash
app.use(flash());

// Inyectar variables globales disponibles en todas las vistas renderizadas por EJS
app.use((req, res, next) => {
    const currentUser = req.user || (req.session && req.session.user) || null;
    res.locals.user = currentUser;
    res.locals.isAuthenticated = !!currentUser;
    res.locals.success_msg = req.flash ? req.flash('success_msg') : null;
    res.locals.error_msg = req.flash ? req.flash('error_msg') : null;
    res.locals.error = req.flash ? req.flash('error') : null;
    res.locals.reset_preview_url = req.flash ? (req.flash('reset_preview_url')[0] || null) : null;
    next();
});

// Importación y montaje de rutas modulares
const indexRoutes   = require('./src/routes/indexRoutes');
const authRoutes    = require('./src/routes/authRoutes');
const panelRoutes   = require('./src/routes/panelRoutes');
const cursoRoutes   = require('./src/routes/cursoRoutes');
const adminRoutes   = require('./src/routes/adminRoutes');
const docenteRoutes = require('./src/routes/docenteRoutes');

app.use('/', indexRoutes);
app.use('/', authRoutes);
app.use('/', panelRoutes);
app.use('/', cursoRoutes);
app.use('/', adminRoutes);
app.use('/', docenteRoutes);

// Gestión de 404 (Not Found)
app.use((req, res) => {
    res.status(404).render('error', {
        mensaje: 'Página no encontrada',
        descripcion: 'Lo sentimos, la página que buscas no existe o ha sido movida.',
        status: 404
    });
});

// Middleware global de manejo de errores (500)
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    logger.error({ err: err.message, stack: err.stack, url: req.originalUrl, method: req.method }, 'Error no controlado en la aplicación');
    res.status(500).render('error', {
        mensaje: 'Error interno del servidor',
        descripcion: isProduction ? 'Ocurrió un error inesperado. Por favor, inténtalo más tarde.' : (err.message || 'Error en el servidor'),
        status: 500
    });
});

// Arrancar el servidor HTTP
const server = app.listen(PORT, () => {
    logger.info(`Servidor corriendo exitosamente en: http://localhost:${PORT}`);
});

// Captura de rechazos no controlados en promesas
process.on('unhandledRejection', (reason) => {
    logger.error({ reason: reason?.message || reason }, 'Unhandled Rejection detectado');
});

process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught Exception crítica');
    process.exit(1);
});

// Apagado limpio (Graceful Shutdown)
function gracefulShutdown(signal) {
    logger.info(`Recibida señal ${signal}. Cerrando servidor limpiamente...`);
    server.close(() => {
        logger.info('Servidor HTTP detenido.');
        mongoose.connection.close(false).then(() => {
            logger.info('Conexión con MongoDB cerrada.');
            process.exit(0);
        }).catch(() => process.exit(0));
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
