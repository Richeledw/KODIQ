/**
 * @file docenteRoutes.js
 * @description Rutas exclusivas para el rol de Docente (teacher).
 * Protegidas con los middlewares isAuth, isDocente y ownCourse, y validadas con express-validator.
 */

const express = require('express');
const router = express.Router();
const docenteController = require('../controllers/docenteController');
const { isAuth, isDocente } = require('../middlewares/auth');
const ownCourse = require('../middlewares/ownCourse');
const {
    validarCurso,
    validarModulo,
    validarLeccion,
    validarRecurso,
    validarProyectoId,
    validarRetroalimentacion
} = require('../middlewares/validation');

// Proteger todas las rutas bajo /docente con isAuth e isDocente
router.use('/docente', isAuth, isDocente);

// Dashboard principal del docente
router.get('/docente/dashboard', docenteController.getDashboard);

// ── Creación y Edición de Cursos Propios ──
router.get('/docente/cursos/nuevo', docenteController.getNuevoCurso);
router.post('/docente/cursos/crear', validarCurso, docenteController.crearCurso);
router.get('/docente/cursos/:id/editar', ownCourse, docenteController.getEditarCurso);
router.post('/docente/cursos/:id/editar', ownCourse, validarCurso, docenteController.editarCurso);
router.post('/docente/cursos/:id/eliminar', ownCourse, docenteController.eliminarCurso);

// ── Constructor de Contenido (Módulos, Lecciones y Recursos) ──
router.get('/docente/cursos/:id/contenido', ownCourse, docenteController.getContenidoCurso);
router.post('/docente/cursos/:id/modulo/crear', ownCourse, validarModulo, docenteController.crearModulo);
router.post('/docente/cursos/:id/modulo/:mIndex/leccion/crear', ownCourse, validarLeccion, docenteController.crearLeccion);
router.post('/docente/cursos/:id/modulo/:mIndex/leccion/:lIndex/eliminar', ownCourse, docenteController.eliminarLeccion);
router.post('/docente/cursos/:id/recurso/crear', ownCourse, validarRecurso, docenteController.crearRecurso);
router.post('/docente/cursos/:id/recurso/:rId/eliminar', ownCourse, docenteController.eliminarRecurso);

// ── Revisión de Proyectos Prácticos ──
router.get('/docente/proyectos', docenteController.getProyectos);
router.post('/docente/proyectos/:id/retroalimentar', validarProyectoId, validarRetroalimentacion, docenteController.retroalimentarProyecto);

module.exports = router;
