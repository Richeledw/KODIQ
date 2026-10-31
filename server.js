/**
 * @file server.js
 * @description Punto de entrada principal para el servidor de Eduplat.
 * Se encarga de inicializar la aplicación Express, configurar middlewares globales (sesiones, passport, recursos estáticos)
 * y registrar las rutas modulares de la arquitectura MVC.
 */

const express = require('express');
const path = require('path');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo').default; // Gestor de persistencia de sesiones en MongoDB
const flash = require('connect-flash');       // Para enviar mensajes informativos temporales entre redirecciones
const dotenv = require('dotenv');

// Cargar variables de entorno del archivo .env
dotenv.config();

// SEGURIDAD: sin SESSION_SECRET el servidor no arranca (antes caía en 'secreto')
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
    console.error('Falta SESSION_SECRET en .env (mínimo 16 caracteres; recomendado 64 hex). Genera uno con:');
    console.error("  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"");
    process.exit(1);
}

// Importar configuración de conexión a la BD y autenticación
const connectDB = require('./src/config/db');

// Inicializar la aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar estrategias de Passport para el manejo de sesiones de usuario
require('./src/config/passport')(passport);

// Establecer la conexión con MongoDB
connectDB();

// ============================================
// CONFIGURACIÓN DEL MOTOR DE VISTAS (EJS)
// ============================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================
// MIDDLEWARES GLOBALES
// ============================================

// Servir archivos estáticos desde el directorio '/public'
// Si se solicita un archivo SVG, nos aseguramos de que el navegador lo interprete con el tipo MIME correcto.
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        // El navegador nunca debe "adivinar" el tipo de un archivo estático
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (filePath.endsWith('.svg')) {
            res.type('image/svg+xml');
        }
        // Archivos subidos por usuarios: aislados, no pueden ejecutar scripts aunque se cuele uno
        if (filePath.includes(`${path.sep}uploads${path.sep}`)) {
            res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
        }
    }
}));

// Middlewares para analizar el cuerpo de las peticiones (Body Parsers)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración de Sesiones con almacenamiento persistente en MongoDB (7 días)
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días de persistencia de sesión
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Inicializar Passport y conectar con la sesión del usuario
app.use(passport.initialize());
app.use(passport.session());

// Habilitar mensajes flash para notificaciones rápidas al usuario
app.use(flash());

// Middleware para inyectar variables globales disponibles en todas las vistas renderizadas por EJS
app.use((req, res, next) => {
    const currentUser = req.user || (req.session && req.session.user) || null;
    res.locals.user = currentUser;
    res.locals.isAuthenticated = !!currentUser;
    res.locals.success_msg = req.flash ? req.flash('success_msg') : null;
    res.locals.error_msg = req.flash ? req.flash('error_msg') : null;
    res.locals.error = req.flash ? req.flash('error') : null; // Errores generados internamente por Passport
    next();
});

// ============================================
// IMPORTACIÓN Y MONTAJE DE RUTAS
// ============================================
const indexRoutes   = require('./src/routes/indexRoutes');
const authRoutes    = require('./src/routes/authRoutes');
const panelRoutes   = require('./src/routes/panelRoutes');
const cursoRoutes   = require('./src/routes/cursoRoutes');
const adminRoutes   = require('./src/routes/adminRoutes');
const docenteRoutes = require('./src/routes/docenteRoutes');

// Montamos los enrutadores en la raíz de la aplicación
app.use('/', indexRoutes);
app.use('/', authRoutes);
app.use('/', panelRoutes);
app.use('/', cursoRoutes);
app.use('/', adminRoutes);
app.use('/', docenteRoutes);

// ============================================
// GESTIÓN DE ERRORES (404 Not Found)
// ============================================
app.use((req, res) => {
    res.status(404).render('error', {
        mensaje: 'Página no encontrada',
        descripcion: 'Lo sentimos, la página que buscas no existe.'
    });
});

// Arrancar el servidor HTTP
app.listen(PORT, () => {
    console.log(`Servidor corriendo exitosamente en: http://localhost:${PORT}`);
});

module.exports = app;
