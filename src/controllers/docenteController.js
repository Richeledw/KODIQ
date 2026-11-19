/**
 * @file docenteController.js
 * @description Controlador para el Panel de Docente (Rol: docente / teacher).
 * Delega la lógica de negocio a courseService.
 */

const Course = require('../models/Course');
const StudentProject = require('../models/StudentProject');
const Enrollment = require('../models/Enrollment');
const courseService = require('../services/courseService');
const contentService = require('../services/contentService');
const logger = require('../utils/logger');

exports.getDashboard = async (req, res) => {
    try {
        const userId = req.user._id;
        const filtro = req.user.rol === 'admin' ? {} : { autor: userId };
        const misCursosDocs = await Course.find(filtro).sort({ creadoEn: -1 });
        const temarios = await contentService.cargarTemarios(misCursosDocs);
        const misCursos = misCursosDocs.map((c) => temarios.get(c.id) || c);

        const cursoIds = misCursos.map((c) => c.id);

        const [totalEstudiantesInscritos, totalProyectosPendientes] = await Promise.all([
            Enrollment.countDocuments({ cursoId: { $in: cursoIds } }),
            StudentProject.countDocuments({ cursoId: { $in: cursoIds }, estado: 'En Revisión' })
        ]);

        res.render('docente/dashboard', {
            titlePage: 'Panel de Docente',
            user: req.user,
            totalCursosPropios: misCursos.length,
            totalEstudiantesInscritos,
            totalProyectosPendientes,
            listaCursos: misCursos
        });
    } catch (err) {
        logger.error({ err }, 'Error en dashboard de docente');
        res.status(500).render('error', {
            mensaje: 'Error interno del servidor',
            descripcion: 'No se pudo cargar el panel del docente.',
            status: 500
        });
    }
};

exports.getNuevoCurso = (req, res) => {
    res.render('docente/curso-form', {
        titlePage: 'Crear Nuevo Curso',
        curso: null,
        esEdicion: false
    });
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
        const cursoIdSlug = (id || titulo)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        const cursoExistente = await Course.findOne({ id: cursoIdSlug });
        if (cursoExistente) {
            req.flash('error_msg', `Ya existe un curso con el identificador "${cursoIdSlug}".`);
            return res.redirect('/docente/cursos/nuevo');
        }

        const nuevoCurso = await Course.create({
            id: cursoIdSlug,
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            descripcionLarga: descripcionLarga ? descripcionLarga.trim() : '',
            categoria: categoria || 'web',
            nivel: nivel || 'Beginner',
            duracion: duracion || '10 horas',
            icono: icono || '/img/html5.svg',
            color: color || 'success',
            autor: req.user._id,
            autorNombre: req.user.nombre,
            publicado: true,
            proyectoConsigna: {
                titulo: proyectoTitulo || 'Proyecto Final del Curso',
                descripcion:
                    proyectoDescripcion ||
                    'Aplica los conceptos impartidos en el curso construyendo una solución práctica.',
                requisitos: ['Estructura limpia', 'Documentación clara', 'Código funcional']
            },
            modulos: [
                {
                    titulo: 'Módulo 1: Introducción y Primeros Pasos',
                    descripcion: 'Comenzando con la materia.',
                    orden: 1,
                    lecciones: [
                        {
                            id: `${cursoIdSlug}-1`,
                            titulo: 'Bienvenida al Curso y Objetivos',
                            duracion: '10 min',
                            videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                            explicacionDetallada:
                                'Bienvenido. En esta lección inicial repasaremos las metas y requisitos del curso.',
                            orden: 1
                        }
                    ]
                }
            ]
        });

        req.flash(
            'success_msg',
            `¡Curso "${nuevoCurso.titulo}" creado exitosamente! Ahora puedes estructurar sus lecciones.`
        );
        res.redirect(`/docente/cursos/${nuevoCurso.id}/contenido`);
    } catch (err) {
        logger.error({ err }, 'Error al crear curso docente');
        req.flash('error_msg', 'Error al crear curso: ' + err.message);
        res.redirect('/docente/cursos/nuevo');
    }
};

exports.getEditarCurso = async (req, res) => {
    try {
        const { id } = req.params;
        const curso = await Course.findOne({ id });

        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/docente/dashboard');
        }

        if (req.user.rol !== 'admin' && curso.autor && curso.autor.toString() !== req.user._id.toString()) {
            req.flash('error_msg', 'Solo puedes editar cursos creados por ti.');
            return res.redirect('/docente/dashboard');
        }

        res.render('docente/curso-form', {
            titlePage: `Editar Curso: ${curso.titulo}`,
            curso,
            esEdicion: true
        });
    } catch (err) {
        logger.error({ err }, 'Error al cargar edición de curso');
        res.status(500).render('error', {
            mensaje: 'Error interno del servidor',
            descripcion: 'No se pudo cargar el formulario de edición.',
            status: 500
        });
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
            proyectoTitulo,
            proyectoDescripcion
        } = req.body;

        const curso = await Course.findOne({ id });
        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/docente/dashboard');
        }

        if (req.user.rol !== 'admin' && curso.autor && curso.autor.toString() !== req.user._id.toString()) {
            req.flash('error_msg', 'Solo puedes editar cursos creados por ti.');
            return res.redirect('/docente/dashboard');
        }

        curso.titulo = titulo.trim();
        curso.descripcion = descripcion.trim();
        curso.descripcionLarga = descripcionLarga ? descripcionLarga.trim() : '';
        curso.categoria = categoria || curso.categoria;
        curso.nivel = nivel || curso.nivel;
        curso.duracion = duracion || curso.duracion;
        curso.icono = icono || curso.icono;
        curso.color = color || curso.color;
        if (proyectoTitulo) curso.proyectoConsigna.titulo = proyectoTitulo.trim();
        if (proyectoDescripcion) curso.proyectoConsigna.descripcion = proyectoDescripcion.trim();

        await curso.save();

        req.flash('success_msg', 'Curso actualizado exitosamente.');
        res.redirect('/docente/dashboard');
    } catch (err) {
        logger.error({ err }, 'Error al actualizar curso docente');
        req.flash('error_msg', 'Error al guardar cambios.');
        res.redirect('/docente/dashboard');
    }
};

exports.eliminarCurso = async (req, res) => {
    try {
        const { id } = req.params;
        const cleanId = (id || '').trim();

        const curso = await Course.findOne({ id: cleanId });
        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado o ya fue eliminado.');
            return res.redirect('/docente/dashboard');
        }

        if (req.user.rol !== 'admin' && curso.autor && curso.autor.toString() !== req.user._id.toString()) {
            req.flash('error_msg', 'Solo puedes eliminar cursos creados por ti.');
            return res.redirect('/docente/dashboard');
        }

        await courseService.eliminarCursoCompleto(cleanId);
        req.flash('success_msg', `Curso "${curso.titulo}" eliminado exitosamente.`);
        res.redirect('/docente/dashboard');
    } catch (err) {
        logger.error({ err }, 'Error al eliminar curso docente');
        req.flash('error_msg', 'Error al eliminar el curso: ' + err.message);
        res.redirect('/docente/dashboard');
    }
};

exports.getContenidoCurso = async (req, res) => {
    try {
        const { id } = req.params;
        const curso = await contentService.cargarCursoCompleto(id, { incluirBloques: true });

        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/docente/dashboard');
        }

        res.render('docente/contenido', {
            titlePage: `Constructor de Contenido: ${curso.titulo}`,
            curso
        });
    } catch (err) {
        logger.error({ err }, 'Error al cargar contenido de curso para docente');
        res.status(500).render('error', {
            mensaje: 'Error interno del servidor',
            descripcion: 'No se pudo cargar el constructor de contenido.',
            status: 500
        });
    }
};

exports.crearModulo = async (req, res) => {
    try {
        const { id } = req.params;
        await courseService.agregarModulo(id, req.body);
        req.flash('success_msg', `Módulo agregado exitosamente.`);
        res.redirect(`/docente/cursos/${id}/contenido`);
    } catch (err) {
        logger.error({ err }, 'Error al crear módulo docente');
        req.flash('error_msg', 'Error al crear módulo: ' + err.message);
        res.redirect(`/docente/cursos/${req.params.id}/contenido`);
    }
};

exports.crearLeccion = async (req, res) => {
    try {
        const { id, moduloId } = req.params;
        await courseService.agregarLeccion(id, moduloId, req.body);
        req.flash('success_msg', `Lección añadida exitosamente.`);
        res.redirect(`/docente/cursos/${id}/contenido`);
    } catch (err) {
        logger.error({ err }, 'Error al crear lección docente');
        req.flash('error_msg', 'Error al añadir lección: ' + err.message);
        res.redirect(`/docente/cursos/${req.params.id}/contenido`);
    }
};

exports.eliminarLeccion = async (req, res) => {
    try {
        const { id, moduloId, leccionId } = req.params;
        await courseService.eliminarLeccion(id, moduloId, leccionId);
        req.flash('success_msg', 'Lección eliminada.');
        res.redirect(`/docente/cursos/${id}/contenido`);
    } catch (err) {
        logger.error({ err }, 'Error al eliminar lección docente');
        req.flash('error_msg', 'Error al eliminar lección: ' + err.message);
        res.redirect(`/docente/cursos/${req.params.id}/contenido`);
    }
};

exports.crearRecurso = async (req, res) => {
    try {
        const { id } = req.params;
        await courseService.agregarRecurso(id, req.body);
        req.flash('success_msg', 'Recurso añadido exitosamente.');
        res.redirect(`/docente/cursos/${id}/contenido`);
    } catch (err) {
        logger.error({ err }, 'Error al crear recurso docente');
        req.flash('error_msg', 'Error al añadir recurso: ' + err.message);
        res.redirect(`/docente/cursos/${req.params.id}/contenido`);
    }
};

exports.eliminarRecurso = async (req, res) => {
    try {
        const { id, rId } = req.params;
        await courseService.eliminarRecurso(id, rId);
        req.flash('success_msg', 'Recurso eliminado.');
        res.redirect(`/docente/cursos/${id}/contenido`);
    } catch (err) {
        logger.error({ err }, 'Error al eliminar recurso docente');
        req.flash('error_msg', 'Error al eliminar recurso: ' + err.message);
        res.redirect(`/docente/cursos/${req.params.id}/contenido`);
    }
};

exports.getProyectos = async (req, res) => {
    try {
        const filtroCursos = req.user.rol === 'admin' ? {} : { autor: req.user._id };
        const cursos = await Course.find(filtroCursos).select('id titulo');
        const cursoIds = cursos.map((c) => c.id);
        const query = { cursoId: { $in: cursoIds } };
        const proyectos = await StudentProject.find(query).sort({ actualizadoEn: -1 });

        res.render('docente/proyectos', {
            titlePage: 'Revisión de Proyectos Prácticos',
            proyectos,
            cursos
        });
    } catch (err) {
        logger.error({ err }, 'Error al cargar proyectos para docente');
        res.status(500).render('error', {
            mensaje: 'Error interno del servidor',
            descripcion: 'No se pudieron cargar los proyectos de tus cursos.',
            status: 500
        });
    }
};

exports.retroalimentarProyecto = async (req, res) => {
    try {
        const { id } = req.params;
        const { comentario, calificacion, estado } = req.body;

        const proyecto = await StudentProject.findById(id);
        if (!proyecto) {
            req.flash('error_msg', 'Proyecto no encontrado.');
            return res.redirect('/docente/proyectos');
        }

        if (req.user.rol !== 'admin') {
            const curso = await Course.findOne({ id: proyecto.cursoId }).select('autor');
            if (!curso || !curso.autor || curso.autor.toString() !== req.user._id.toString()) {
                req.flash('error_msg', 'No tienes permiso para calificar este proyecto.');
                return res.redirect('/docente/proyectos');
            }
        }

        await courseService.aplicarRetroalimentacion(id, {
            calificacion,
            estado,
            comentario,
            evaluadorId: req.user._id,
            evaluadorNombre: req.user.nombre,
            evaluadorRol: 'docente'
        });

        req.flash('success_msg', 'Retroalimentación y calificación registradas exitosamente.');
        res.redirect('/docente/proyectos');
    } catch (err) {
        logger.error({ err }, 'Error al retroalimentar proyecto en docente');
        req.flash('error_msg', 'Error al guardar la retroalimentación.');
        res.redirect('/docente/proyectos');
    }
};
