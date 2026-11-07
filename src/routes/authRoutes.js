/**
 * @file authRoutes.js
 * @description Define el enrutador para las acciones de autenticación (registro, login, logout, sesión API).
 * Incluye rate limiting y validación centralizada en los endpoints sensibles.
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { redirectIfAuth } = require('../middlewares/auth');
const {
    loginLimiter,
    registerLimiter,
    forgotPasswordLimiter,
    resetPasswordLimiter
} = require('../middlewares/rateLimiters');
const {
    validarRegistro,
    validarLogin,
    validarOlvidePassword,
    validarResetPassword,
    validarTokenReset
} = require('../middlewares/validation');

// Ruta para mostrar el formulario de registro (redirige si ya está autenticado)
router.get('/registro', redirectIfAuth, authController.getRegistro);

// Ruta para procesar los datos de registro (5 por hora e IP)
router.post('/registro', registerLimiter, validarRegistro, authController.postRegistro);

// Ruta para mostrar el formulario de login (redirige si ya está autenticado)
router.get('/login', redirectIfAuth, authController.getLogin);

// Ruta para procesar el intento de inicio de sesión (10 intentos / 15 min)
router.post('/login', loginLimiter, validarLogin, authController.postLogin);

// Cierre de sesión por POST (evita logout por enlaces/prefetch)
router.post('/logout', authController.postLogout);

// Endpoint API para consultar el estado actual de la sesión
router.get('/api/auth/session', (req, res) => {
    if (req.isAuthenticated()) {
        return res.json({
            authenticated: true,
            user: {
                id: req.user._id,
                nombre: req.user.nombre,
                email: req.user.email,
                rol: req.user.rol
            }
        });
    }
    return res.json({ authenticated: false, user: null });
});

// Rutas de Recuperación de Contraseña
router.get('/olvide-password', redirectIfAuth, authController.getOlvidePassword);
router.post('/olvide-password', forgotPasswordLimiter, validarOlvidePassword, authController.postOlvidePassword);
router.get('/reset-password/:token', redirectIfAuth, validarTokenReset, authController.getResetPassword);
router.post(
    '/reset-password/:token',
    resetPasswordLimiter,
    validarTokenReset,
    validarResetPassword,
    authController.postResetPassword
);

module.exports = router;
