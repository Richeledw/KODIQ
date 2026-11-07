/**
 * @file projectController.js
 * @description Revisión y retroalimentación de proyectos prácticos en el panel Admin.
 */

const StudentProject = require('../../models/StudentProject');
const courseService = require('../../services/courseService');
const logger = require('../../utils/logger');

exports.getProyectos = async (req, res) => {
    try {
        const proyectos = await StudentProject.find().sort({ actualizadoEn: -1 });
        res.render('admin/proyectos', {
            titlePage: 'Revisión Global de Proyectos Prácticos',
            proyectos
        });
    } catch (err) {
        logger.error({ err }, 'Error al cargar proyectos en admin');
        res.status(500).render('error', {
            mensaje: 'Error interno del servidor',
            descripcion: 'No se pudieron cargar los proyectos para revisión.',
            status: 500
        });
    }
};

exports.retroalimentarProyecto = async (req, res) => {
    try {
        const { id } = req.params;
        const { comentario, calificacion, estado } = req.body;

        await courseService.aplicarRetroalimentacion(id, {
            calificacion,
            estado,
            comentario,
            evaluadorId: req.user._id,
            evaluadorNombre: req.user.nombre,
            evaluadorRol: 'admin'
        });

        req.flash('success_msg', 'Retroalimentación y calificación registradas exitosamente.');
        res.redirect('/admin/proyectos');
    } catch (err) {
        logger.error({ err }, 'Error al retroalimentar proyecto en admin');
        req.flash('error_msg', 'Error al guardar la revisión: ' + err.message);
        res.redirect('/admin/proyectos');
    }
};
