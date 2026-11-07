/**
 * @file indexRoutes.js
 * @description Define el enrutador para las páginas públicas generales (Home y Contacto).
 */

const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');
const { contactLimiter } = require('../middlewares/rateLimiters');
const { validarContacto } = require('../middlewares/validation');

// Ruta para la página de inicio (Landing Page)
router.get('/', indexController.getHome);

// Ruta para ver la página y el formulario de contacto
router.get('/contacto', indexController.getContacto);

// Ruta para procesar el envío del formulario de contacto (5 mensajes por hora e IP)
router.post('/contacto', contactLimiter, validarContacto, indexController.postContacto);

// Mapa del sitio XML para indexación SEO
router.get('/sitemap.xml', indexController.getSitemap);

module.exports = router;
