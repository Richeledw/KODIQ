/**
 * @file catalogController.js
 * @description Catálogo público de cursos, ficha técnica e inscripción de estudiantes.
 */

const Course = require('../../models/Course');
const User = require('../../models/User');
const Enrollment = require('../../models/Enrollment');
const StudentProject = require('../../models/StudentProject');
const staticCursos = require('../../models/cursosData');
const progressService = require('../../services/progressService');
const contentService = require('../../services/contentService');
const logger = require('../../utils/logger');

/**
 * Un curso despublicado solo es visible para un admin o para su autor.
 * @param {Object} curso
 * @param {Object} user
 * @returns {boolean}
 */
function puedeVerCursoNoPublicado(curso, user) {
    if (!user) return false;
    if (user.rol === 'admin') return true;
    return Boolean(curso.autor && String(curso.autor) === String(user._id));
}

exports.getTemas = async (req, res) => {
    try {
        const cursosDocs = await Course.find({ publicado: true }).sort({ creadoEn: -1 });
        let cursos;

        if (!cursosDocs || cursosDocs.length === 0) {
            cursos = Object.values(staticCursos);
        } else {
            const temarios = await contentService.cargarTemarios(cursosDocs, { soloPublicado: true });
            cursos = cursosDocs.map((c) => temarios.get(c.id) || c);
        }

        let inscritosIds = [];
        if (req.user) {
            const inscripciones = await Enrollment.find({ estudiante: req.user.id }).select('cursoId');
            inscritosIds = inscripciones.map((i) => i.cursoId);
        }

        res.render('temas', {
            datosTemas: {
                titulo: 'Nuestros Cursos',
                descripcion: 'Explora nuestra amplia variedad de cursos prácticos y certificados',
                cursos: cursos,
                inscritosIds: inscritosIds
            }
        });
    } catch (err) {
        logger.error({ err }, 'Error al obtener catálogo de cursos');
        res.status(500).render('error', {
            mensaje: 'Error del servidor',
            descripcion: 'No se pudieron cargar los cursos en este momento.',
            status: 500
        });
    }
};

exports.getCurso = async (req, res) => {
    const { id } = req.params;

    try {
        let curso = await contentService.cargarCursoCompleto(id, { soloPublicado: true });

        if (!curso && staticCursos[id]) {
            curso = { id, ...staticCursos[id], modulos: [], recursosGlobales: [] };
        }

        if (!curso) {
            return res.status(404).render('error', {
                mensaje: 'Curso no encontrado',
                descripcion: 'El curso que buscas no existe o ha sido retirado.',
                status: 404
            });
        }

        if (curso.publicado === false && !puedeVerCursoNoPublicado(curso, req.user)) {
            return res.status(404).render('error', {
                mensaje: 'Curso no disponible',
                descripcion: 'El curso que buscas no está publicado en este momento.',
                status: 404
            });
        }

        const cursosRelacionados = await Course.find({
            categoria: curso.categoria,
            publicado: true,
            id: { $ne: id }
        }).limit(3);

        let estaInscrito = false;
        let progresoInscripcion = 0;

        if (req.user) {
            const inscripcion = await progressService.obtenerInscripcion(req.user.id, curso);
            if (inscripcion) {
                estaInscrito = true;
                progresoInscripcion = inscripcion.progreso || 0;
            }
        }

        res.render('curso', {
            datosCurso: {
                ...(curso.toObject ? curso.toObject() : curso),
                cursos_relacionados: cursosRelacionados,
                estaInscrito,
                progresoInscripcion
            }
        });
    } catch (err) {
        logger.error({ err }, 'Error al obtener ficha de curso');
        res.status(500).render('error', {
            mensaje: 'Error al cargar el curso',
            descripcion: 'Ocurrió un error inesperado al consultar los datos del curso.',
            status: 500
        });
    }
};

exports.postInscribir = async (req, res) => {
    if (!req.isAuthenticated()) {
        req.flash('error_msg', 'Debes iniciar sesión para inscribirte a un curso.');
        return res.redirect('/login');
    }

    const { id } = req.params;

    try {
        const curso = await Course.findOne({ id });
        if (!curso) {
            req.flash('error_msg', 'El curso seleccionado no existe.');
            return res.redirect('/temas');
        }

        if (curso.publicado === false && !puedeVerCursoNoPublicado(curso, req.user)) {
            req.flash('error_msg', 'Este curso no está disponible para inscripción en este momento.');
            return res.redirect('/temas');
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/login');
        }

        const inscripcionPrevia = await progressService.obtenerInscripcion(user._id, curso);

        if (!inscripcionPrevia) {
            await progressService.crearInscripcion(user, curso);

            const proyectoExistente = await StudentProject.findOne({ estudiante: user._id, cursoId: id });
            if (!proyectoExistente) {
                await StudentProject.create({
                    estudiante: user._id,
                    estudianteNombre: user.nombre,
                    estudianteEmail: user.email,
                    cursoId: id,
                    cursoTitulo: curso.titulo,
                    titulo: `Proyecto: ${curso.proyectoConsigna?.titulo || curso.titulo}`,
                    descripcion: '',
                    notasAvance: '',
                    estado: 'En Progreso'
                });
            }

            req.flash('success_msg', `¡Felicitaciones! Te has inscrito exitosamente en "${curso.titulo}".`);
        } else {
            req.flash('success_msg', `Ya estás inscrito en "${curso.titulo}". ¡Continuemos aprendiendo!`);
        }

        return res.redirect(`/curso/${id}/aula`);
    } catch (err) {
        logger.error({ err }, 'Error al procesar inscripción');
        req.flash('error_msg', 'Ocurrió un error al procesar tu matrícula.');
        res.redirect(`/curso/${id}`);
    }
};
