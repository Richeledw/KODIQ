/**
 * @file courseService.js
 * @description Capa de servicio centralizada para la manipulación y gestión de cursos,
 * módulos, lecciones, recursos y retroalimentación de proyectos.
 * Desacopla la lógica de base de datos de los controladores de Admin y Docente.
 */

const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const StudentProject = require('../models/StudentProject');
const User = require('../models/User');
const contentService = require('./contentService');
const mediaService = require('./mediaService');

/**
 * Agrega un nuevo módulo a un curso (colección `Module`).
 * @param {string} cursoSlug Identificador id del curso.
 * @param {object} param1 { titulo, descripcion }
 */
async function agregarModulo(cursoSlug, { titulo, descripcion }) {
    await contentService.crearModulo(cursoSlug, { titulo, descripcion });
    return contentService.cargarCursoCompleto(cursoSlug);
}

/**
 * Agrega una lección a un módulo específico (buscado por _id o índice).
 * Los campos clásicos del formulario (videoUrl, explicacionDetallada, codigoEjemplo)
 * se convierten en bloques de contenido. También acepta `bloques` directamente.
 * @param {string} cursoSlug
 * @param {string} moduloId Identificador _id o índice del módulo.
 * @param {object} leccionData
 */
async function agregarLeccion(cursoSlug, moduloId, leccionData) {
    const { titulo, duracion, videoUrl, explicacionDetallada, codigoEjemplo, lenguajeCodigo, bloques } =
        leccionData || {};
    await contentService.crearLeccion(cursoSlug, moduloId, {
        titulo,
        duracion,
        videoUrl,
        explicacionDetallada,
        codigoEjemplo,
        lenguajeCodigo,
        bloques
    });
    return contentService.cargarCursoCompleto(cursoSlug);
}

/**
 * Elimina una lección de un módulo.
 * @param {string} cursoSlug
 * @param {string} moduloId
 * @param {string} leccionId
 */
async function eliminarLeccion(cursoSlug, moduloId, leccionId) {
    await contentService.eliminarLeccion(cursoSlug, moduloId, leccionId);
    return contentService.cargarCursoCompleto(cursoSlug);
}

/**
 * Agrega un recurso global a un curso.
 * @param {string} cursoSlug
 * @param {object} recursoData
 */
async function agregarRecurso(cursoSlug, recursoData) {
    const curso = await Course.findOne({ id: cursoSlug });
    if (!curso) throw new Error('Curso no encontrado');

    const { titulo, tipo, url, descripcion } = recursoData;
    curso.recursosGlobales.push({
        titulo: String(titulo).trim(),
        tipo: tipo || 'link',
        url: String(url).trim(),
        descripcion: descripcion ? String(descripcion).trim() : ''
    });

    await curso.save();
    return curso;
}

/**
 * Elimina un recurso global de un curso.
 * @param {string} cursoSlug
 * @param {string} recursoId
 */
async function eliminarRecurso(cursoSlug, recursoId) {
    const curso = await Course.findOne({ id: cursoSlug });
    if (!curso) throw new Error('Curso no encontrado');

    const indice = (curso.recursosGlobales || []).findIndex((r) => String(r._id) === String(recursoId));
    if (indice === -1) throw new Error('Recurso no encontrado');

    curso.recursosGlobales.splice(indice, 1);
    await curso.save();
    return curso;
}

/**
 * Elimina un curso y cascada de inscripciones, proyectos y referencias.
 * @param {string} cursoSlug
 */
async function eliminarCursoCompleto(cursoSlug) {
    const cleanId = String(cursoSlug || '').trim();
    const cursoEliminado = await Course.findOneAndDelete({
        $or: [{ id: cleanId }, { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null }]
    });

    if (!cursoEliminado) throw new Error('Curso no encontrado');

    const slug = cursoEliminado.id || cleanId;
    await Promise.all([
        Enrollment.deleteMany({ cursoId: slug }),
        StudentProject.deleteMany({ cursoId: slug }),
        User.updateMany({ cursosInscritos: slug }, { $pull: { cursosInscritos: slug } }),
        contentService.eliminarContenidoDeCurso(cursoEliminado._id),
        mediaService.eliminarAssetsDeCurso(cursoEliminado._id)
    ]);

    return cursoEliminado;
}

/**
 * Califica y envía retroalimentación a un proyecto práctico.
 * @param {string} proyectoId
 * @param {object} datos
 */
async function aplicarRetroalimentacion(
    proyectoId,
    { calificacion, estado, comentario, evaluadorId, evaluadorNombre, evaluadorRol }
) {
    const proyecto = await StudentProject.findById(proyectoId);
    if (!proyecto) throw new Error('Proyecto no encontrado');

    if (comentario && String(comentario).trim().length > 0) {
        proyecto.retroalimentacion.push({
            docenteId: evaluadorId,
            docenteNombre: evaluadorNombre,
            docenteRol: evaluadorRol || 'docente',
            comentario: String(comentario).trim(),
            fecha: new Date()
        });
    }

    if (calificacion !== undefined && calificacion !== '') {
        const califNum = Math.min(100, Math.max(0, parseInt(calificacion, 10) || 0));
        proyecto.calificacion = califNum;
        if (!estado) {
            proyecto.estado = califNum >= 70 ? 'Completado' : 'Requiere Cambios';
        }
    }

    if (estado) {
        proyecto.estado = estado;
    }

    proyecto.actualizadoEn = new Date();
    await proyecto.save();
    return proyecto;
}

module.exports = {
    agregarModulo,
    agregarLeccion,
    eliminarLeccion,
    agregarRecurso,
    eliminarRecurso,
    eliminarCursoCompleto,
    aplicarRetroalimentacion
};
