/**
 * @file courseController.js
 * @description Gestión global de cursos, módulos, lecciones y recursos para Administradores.
 * Delega la lógica de negocio a courseService.
 */

const Course = require('../../models/Course');
const courseService = require('../../services/courseService');
const contentService = require('../../services/contentService');
const logger = require('../../utils/logger');

exports.getCursos = async (req, res) => {
    try {
        const cursosDocs = await Course.find().sort({ creadoEn: -1 });
        const temarios = await contentService.cargarTemarios(cursosDocs);
        const cursos = cursosDocs.map((c) => temarios.get(c.id) || c);
        res.render('admin/cursos', {
            titlePage: 'Gestión Global de Cursos',
            cursos
        });
    } catch (err) {
        logger.error({ err }, 'Error al cargar cursos en admin');
        res.status(500).render('error', {
            mensaje: 'Error interno del servidor',
            descripcion: 'No se pudo cargar la lista de cursos.',
            status: 500
        });
    }
};

exports.crearCurso = async (req, res) => {
    try {
        const {
            id,
            titulo,
            descripcion,
            descripcionLarga,
            categoria,
            nivel,
            duracion,
            icono,
            color,
            proyectoTitulo,
            proyectoDescripcion
        } = req.body;

        const cursoExistente = await Course.findOne({ id: id.trim() });
        if (cursoExistente) {
            req.flash('error_msg', 'Ya existe un curso registrado con ese identificador (slug).');
            return res.redirect('/admin/cursos');
        }

        const nuevoCurso = new Course({
            id: id.trim(),
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            descripcionLarga: descripcionLarga ? descripcionLarga.trim() : '',
            categoria: categoria || 'general',
            nivel: nivel || 'Beginner',
            duracion: duracion ? duracion.trim() : '10 horas',
            icono: icono ? icono.trim() : '/img/html5.svg',
            color: color || 'primary',
            autor: req.user._id,
            autorNombre: req.user.nombre,
            publicado: true,
            proyectoConsigna: {
                titulo: proyectoTitulo || 'Proyecto Práctico Final',
                descripcion: proyectoDescripcion || 'Aplica los conocimientos adquiridos a lo largo de este curso.',
                requisitos: ['Código limpio y modular', 'Pruebas ejecutadas']
            },
            modulos: [],
            recursosGlobales: []
        });

        await nuevoCurso.save();
        req.flash('success_msg', `Curso "${nuevoCurso.titulo}" creado exitosamente.`);
        res.redirect('/admin/cursos');
    } catch (err) {
        logger.error({ err }, 'Error al crear curso en admin');
        req.flash('error_msg', 'Error al procesar la creación del curso.');
        res.redirect('/admin/cursos');
    }
};

exports.editarCurso = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            titulo,
            descripcion,
            descripcionLarga,
            categoria,
            nivel,
            duracion,
            icono,
            color,
            publicado,
            proyectoTitulo,
            proyectoDescripcion
        } = req.body;

        const cursoActualizado = await Course.findOneAndUpdate(
            { id },
            {
                titulo: titulo.trim(),
                descripcion: descripcion.trim(),
                descripcionLarga: descripcionLarga ? descripcionLarga.trim() : '',
                categoria,
                nivel,
                duracion: duracion.trim(),
                icono: icono.trim(),
                color,
                publicado: publicado === 'on' || publicado === true || publicado === 'true',
                'proyectoConsigna.titulo': proyectoTitulo || 'Proyecto Final Práctico',
                'proyectoConsigna.descripcion': proyectoDescripcion || ''
            },
            { new: true }
        );

        if (!cursoActualizado) {
            req.flash('error_msg', 'El curso no existe o ya fue eliminado.');
            return res.redirect('/admin/cursos');
        }

        req.flash('success_msg', 'Curso actualizado exitosamente.');
        res.redirect('/admin/cursos');
    } catch (err) {
        logger.error({ err }, 'Error al editar curso en admin');
        req.flash('error_msg', 'Error al actualizar el curso.');
        res.redirect('/admin/cursos');
    }
};

exports.eliminarCurso = async (req, res) => {
    try {
        const { id } = req.params;
        const cursoEliminado = await courseService.eliminarCursoCompleto(id);
        req.flash('success_msg', `Curso "${cursoEliminado.titulo}" eliminado exitosamente de la plataforma.`);
        res.redirect('/admin/cursos');
    } catch (err) {
        logger.error({ err }, 'Error al eliminar curso en admin');
        req.flash('error_msg', 'Error al procesar la eliminación del curso: ' + err.message);
        res.redirect('/admin/cursos');
    }
};

exports.getContenidoCurso = async (req, res) => {
    try {
        const { id } = req.params;
        const curso = await contentService.cargarCursoCompleto(id, { incluirBloques: true });

        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/admin/cursos');
        }

        res.render('admin/contenido', {
            titlePage: `Contenido: ${curso.titulo}`,
            curso
        });
    } catch (err) {
        logger.error({ err }, 'Error al cargar contenido de curso en admin');
        res.status(500).render('error', {
            mensaje: 'Error interno del servidor',
            descripcion: 'No se pudo cargar el contenido del curso.',
            status: 500
        });
    }
};

exports.crearModulo = async (req, res) => {
    try {
        const { id } = req.params;
        await courseService.agregarModulo(id, req.body);
        req.flash('success_msg', 'Módulo agregado exitosamente.');
        res.redirect(`/admin/cursos/${id}/contenido`);
    } catch (err) {
        logger.error({ err }, 'Error al crear módulo en admin');
        req.flash('error_msg', 'Error al crear módulo: ' + err.message);
        res.redirect(`/admin/cursos/${req.params.id}/contenido`);
    }
};

exports.crearLeccion = async (req, res) => {
    try {
        const { id, moduloId } = req.params;
        await courseService.agregarLeccion(id, moduloId, req.body);
        req.flash('success_msg', 'Lección agregada exitosamente.');
        res.redirect(`/admin/cursos/${id}/contenido`);
    } catch (err) {
        logger.error({ err }, 'Error al crear lección en admin');
        req.flash('error_msg', 'Error al crear lección: ' + err.message);
        res.redirect(`/admin/cursos/${req.params.id}/contenido`);
    }
};

exports.eliminarLeccion = async (req, res) => {
    try {
        const { id, moduloId, leccionId } = req.params;
        await courseService.eliminarLeccion(id, moduloId, leccionId);
        req.flash('success_msg', 'Lección eliminada.');
        res.redirect(`/admin/cursos/${id}/contenido`);
    } catch (err) {
        logger.error({ err }, 'Error al eliminar lección en admin');
        req.flash('error_msg', 'Error al eliminar lección: ' + err.message);
        res.redirect(`/admin/cursos/${req.params.id}/contenido`);
    }
};

exports.crearRecurso = async (req, res) => {
    try {
        const { id } = req.params;
        await courseService.agregarRecurso(id, req.body);
        req.flash('success_msg', 'Recurso agregado exitosamente.');
        res.redirect(`/admin/cursos/${id}/contenido`);
    } catch (err) {
        logger.error({ err }, 'Error al crear recurso en admin');
        req.flash('error_msg', 'Error al crear recurso: ' + err.message);
        res.redirect(`/admin/cursos/${req.params.id}/contenido`);
    }
};

exports.eliminarRecurso = async (req, res) => {
    try {
        const { id, rId } = req.params;
        await courseService.eliminarRecurso(id, rId);
        req.flash('success_msg', 'Recurso eliminado.');
        res.redirect(`/admin/cursos/${id}/contenido`);
    } catch (err) {
        logger.error({ err }, 'Error al eliminar recurso en admin');
        req.flash('error_msg', 'Error al eliminar recurso: ' + err.message);
        res.redirect(`/admin/cursos/${req.params.id}/contenido`);
    }
};
