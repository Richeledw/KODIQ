/**
 * @file panelRoutes.js
 * @description Define el enrutador para las vistas del panel de control y de ajustes de configuración.
 * Estas rutas son de acceso restringido y requieren estar autenticado.
 */

const express = require('express');
const router = express.Router();
const panelController = require('../controllers/panelController');

// Importamos el middleware que verifica la autenticación del usuario y la subida de archivos
const { isAuth } = require('../middlewares/auth');
const { uploadAvatar } = require('../middlewares/upload');
const { validarPerfil, validarCambioPassword } = require('../middlewares/validation');

// Ruta para visualizar el dashboard personal del estudiante (Protegida)
router.get('/panel', isAuth, panelController.getPanel);

// Ruta para visualizar y modificar la configuración del perfil del usuario (Protegida)
router.get('/configuracion', isAuth, panelController.getConfiguracion);
router.post('/configuracion/perfil', isAuth, validarPerfil, panelController.postActualizarPerfil);
router.post('/configuracion/avatar', isAuth, uploadAvatar, panelController.postActualizarAvatar);
router.post('/configuracion/password', isAuth, validarCambioPassword, panelController.postCambiarPassword);
router.post('/configuracion/eliminar-cuenta', isAuth, panelController.postEliminarCuenta);

module.exports = router;
