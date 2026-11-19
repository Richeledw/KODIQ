/**
 * @file mediaRoutes.js
 * @description Rutas para servir archivos desde MongoDB GridFS (con soporte de HTTP Range y control
 * de acceso por inscripción) y para que docentes/administradores suban o gestionen archivos de un curso.
 */

const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const { isAuth, isDocente } = require('../middlewares/auth');
const ownCourse = require('../middlewares/ownCourse');
const { uploadCourseMedia } = require('../middlewares/uploadMedia');

// Descarga / streaming de archivos (públicos, de vista previa o de cursos con matrícula activa)
router.get('/media/:assetId', mediaController.servirMedia);

// Gestión de archivos de un curso (solo docente propietario o admin)
router.get('/curso/:id/media', isAuth, isDocente, ownCourse, mediaController.listarMediaCurso);
router.post('/curso/:id/media/subir', isAuth, isDocente, ownCourse, uploadCourseMedia, mediaController.subirMediaCurso);
router.delete('/curso/:id/media/:assetId', isAuth, isDocente, ownCourse, mediaController.eliminarMediaCurso);
router.post('/curso/:id/media/:assetId/eliminar', isAuth, isDocente, ownCourse, mediaController.eliminarMediaCurso);

module.exports = router;
