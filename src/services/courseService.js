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

/**
 * Agrega un nuevo módulo a un curso.
 * @param {string} cursoSlug Identificador id del curso.
 * @param {object} param1 { titulo, descripcion }
 */
async function agregarModulo(cursoSlug, { titulo, descripcion }) {
    const curso = await Course.findOne({ id: cursoSlug });
    if (!curso) throw new Error('Curso no encontrado');

    const orden = (curso.modulos ? curso.modulos.length : 0) + 1;
    curso.modulos.push({
        titulo: String(titulo).trim(),
        descripcion: descripcion ? String(descripcion).trim() : '',
        orden,
        lecciones: [],
        quiz: []
    });

    await curso.save();
    return curso;
}

/**
 * Agrega una lección a un módulo específico (buscado por _id o índice).
 * @param {string} cursoSlug
 * @param {string} moduloId Identificador _id o índice del módulo.
 * @param {object} leccionData
 */
async function agregarLeccion(cursoSlug, moduloId, leccionData) {
    const curso = await Course.findOne({ id: cursoSlug });
    if (!curso) throw new Error('Curso no encontrado');

    let modulo = curso.modulos.find((m) => String(m._id) === String(moduloId));
    if (!modulo && /^\d+$/.test(String(moduloId))) {
        modulo = curso.modulos[Number(moduloId)];
    }
    if (!modulo) throw new Error('Módulo no encontrado');

    if (!Array.isArray(modulo.lecciones)) {
        modulo.lecciones = [];
    }

    const orden = modulo.lecciones.length + 1;
    const { titulo, duracion, videoUrl, explicacionDetallada, codigoEjemplo, lenguajeCodigo } = leccionData;

    modulo.lecciones.push({
        id: `${cursoSlug}-m${modulo.orden || 1}-l${orden}`,
        titulo: String(titulo).trim(),
        duracion: duracion ? String(duracion).trim() : '15 min',
        videoUrl: videoUrl ? String(videoUrl).trim() : '',
        explicacionDetallada: explicacionDetallada ? String(explicacionDetallada).trim() : '',
        codigoEjemplo: codigoEjemplo || '',
        lenguajeCodigo: lenguajeCodigo || 'javascript',
        orden
    });

    await curso.save();
    return curso;
}

/**
 * Elimina una lección de un módulo.
 * @param {string} cursoSlug
 * @param {string} moduloId
 * @param {string} leccionId
 */
async function eliminarLeccion(cursoSlug, moduloId, leccionId) {
    const curso = await Course.findOne({ id: cursoSlug });
    if (!curso) throw new Error('Curso no encontrado');

    let modulo = curso.modulos.find((m) => String(m._id) === String(moduloId));
    if (!modulo && /^\d+$/.test(String(moduloId))) {
        modulo = curso.modulos[Number(moduloId)];
    }
    if (!modulo || !Array.isArray(modulo.lecciones)) throw new Error('Módulo no encontrado');

    let indice = modulo.lecciones.findIndex((l) =>
        String(l._id) === String(leccionId) || String(l.id) === String(leccionId)
    );
    if (indice === -1 && /^\d+$/.test(String(leccionId))) {
        indice = Number(leccionId);
    }
    if (indice === -1 || !modulo.lecciones[indice]) throw new Error('Lección no encontrada');

    modulo.lecciones.splice(indice, 1);
    await curso.save();
    return curso;
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
        User.updateMany(
            { cursosInscritos: slug },
            { $pull: { cursosInscritos: slug } }
        )
    ]);

    return cursoEliminado;
}

/**
 * Califica y envía retroalimentación a un proyecto práctico.
 * @param {string} proyectoId
 * @param {object} datos
 */
async function aplicarRetroalimentacion(proyectoId, { calificacion, estado, comentario, evaluadorId, evaluadorNombre, evaluadorRol }) {
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
