/**
 * @file progressService.js
 * @description Fuente única del progreso académico.
 *
 * Decisión de diseño:
 *  - `Enrollment` es la fuente de verdad (una inscripción por estudiante/curso).
 *  - `User.cursosInscritos` se conserva como espejo legado para no romper datos
 *    ni código antiguo; se rellena automáticamente la primera vez que se lee.
 *  - Las lecciones se identifican por su slug `leccion.id`, que es estable aunque
 *    se reordenen módulos o lecciones, o se migren a la colección `Lesson`.
 *  - Soporta tanto cursos ya hidratados con `curso.modulos` como documentos `Course`
 *    cuyas lecciones viven en la colección `Lesson`.
 *  - Registra además el segundo exacto de reproducción de cada video (`progresoVideos`)
 *    y los resultados porcentuales de quizzes por módulo o por bloque (`progresoQuizzes`).
 */

const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const User = require('../models/User');

/** Aplana los módulos en memoria del curso en una lista de lecciones con su módulo. */
function obtenerLecciones(curso) {
    const lecciones = [];
    if (!curso || !Array.isArray(curso.modulos)) return lecciones;

    curso.modulos.forEach((modulo) => {
        (modulo.lecciones || []).forEach((leccion) => {
            lecciones.push({
                ...(typeof leccion.toObject === 'function' ? leccion.toObject() : leccion),
                moduloId: modulo._id ? modulo._id.toString() : null,
                moduloTitulo: modulo.titulo
            });
        });
    });

    return lecciones;
}

/**
 * Obtiene las lecciones del curso desde memoria (`curso.modulos`) o, si el documento
 * no fue hidratado con `cargarCursoCompleto`, consultando la colección `Lesson`.
 */
async function obtenerLeccionesCurso(curso) {
    const enMemoria = obtenerLecciones(curso);
    if (enMemoria.length > 0) return enMemoria;
    if (!curso || !curso._id) return [];

    const docs = await Lesson.find({ curso: curso._id })
        .select('id _id titulo duracion duracionMin modulo orden vistaPrevia publicado videoPrincipal resumen')
        .sort({ orden: 1, _id: 1 })
        .lean();

    return docs.map((l) => ({
        ...l,
        moduloId: l.modulo ? String(l.modulo) : null
    }));
}

/** Clave estable de una lección para el progreso (slug `id`). */
function claveLeccion(leccion) {
    if (!leccion) return '';
    return String(leccion.id || leccion._id || '');
}

/** Conjunto de claves válidas del curso (sincrónico, sobre `curso.modulos`). */
function clavesValidas(curso, listaLecciones) {
    const fuente = Array.isArray(listaLecciones) ? listaLecciones : obtenerLecciones(curso);
    return new Set(fuente.map(claveLeccion).filter(Boolean));
}

/**
 * Elimina IDs inexistentes, duplicados y valores no string.
 * Evita que un progreso viejo o manipulado supere el 100 %.
 */
function normalizarCompletadas(curso, completadas, listaLecciones) {
    const validas = clavesValidas(curso, listaLecciones);
    const unicas = new Set();

    (Array.isArray(completadas) ? completadas : []).forEach((valor) => {
        const clave = String(valor || '');
        if (!clave) return;
        // Cursos antiguos del catálogo estático no tienen módulos en BD:
        // conservamos sus IDs históricos en lugar de borrarlos.
        if (validas.size === 0 || validas.has(clave)) unicas.add(clave);
    });

    return Array.from(unicas);
}

/** Porcentaje entero entre 0 y 100. */
function calcularProgreso(total, completadas) {
    const totalNum = Number(total);
    if (!Number.isFinite(totalNum) || totalNum <= 0) return 0;

    const completadasNum = Math.min(Math.max(Number(completadas) || 0, 0), totalNum);
    return Math.min(100, Math.max(0, Math.round((completadasNum / totalNum) * 100)));
}

/**
 * Devuelve la inscripción canónica del estudiante en el curso.
 * Si solo existe el registro legado en `User.cursosInscritos`, lo migra de
 * forma perezosa a `Enrollment` y devuelve la inscripción nueva.
 */
async function obtenerInscripcion(estudianteId, curso) {
    if (!estudianteId || !curso) return null;

    const lecciones = await obtenerLeccionesCurso(curso);

    let inscripcion = await Enrollment.findOne({
        estudiante: estudianteId,
        cursoId: curso.id
    });

    if (inscripcion) {
        const completadas = normalizarCompletadas(curso, inscripcion.leccionesCompletadas, lecciones);
        const total = lecciones.length;
        const progreso =
            total > 0
                ? calcularProgreso(total, completadas.length)
                : Math.min(100, Math.max(0, Number(inscripcion.progreso) || 0));
        const cambio =
            completadas.length !== (inscripcion.leccionesCompletadas || []).length || progreso !== inscripcion.progreso;

        if (cambio) {
            inscripcion.leccionesCompletadas = completadas;
            inscripcion.progreso = progreso;
            inscripcion.ultimoAcceso = new Date();
            await inscripcion.save();
        }

        return inscripcion;
    }

    // Migración perezosa desde el modelo legado.
    const usuario = await User.findById(estudianteId).select('cursosInscritos');
    const legado =
        usuario && usuario.cursosInscritos ? usuario.cursosInscritos.find((c) => c.cursoId === curso.id) : null;

    if (!legado) return null;

    const completadas = normalizarCompletadas(curso, legado.leccionesCompletadas, lecciones);
    const total = lecciones.length;

    try {
        inscripcion = await Enrollment.create({
            estudiante: estudianteId,
            curso: curso._id,
            cursoId: curso.id,
            fechaInscripcion: legado.fechaInscripcion || new Date(),
            leccionesCompletadas: completadas,
            progreso:
                total > 0
                    ? calcularProgreso(total, completadas.length)
                    : Math.min(100, Math.max(0, Number(legado.progreso) || 0)),
            ultimoAcceso: new Date()
        });
    } catch (err) {
        if (err && err.code === 11000) {
            inscripcion = await Enrollment.findOne({
                estudiante: estudianteId,
                cursoId: curso.id
            });
        } else {
            throw err;
        }
    }

    return inscripcion;
}

/**
 * Crea la inscripción si no existe (inscripción explícita) y sincroniza el
 * espejo legado. No auto-inscribe desde el aula.
 */
async function crearInscripcion(estudiante, curso) {
    const inscripcion = await Enrollment.findOneAndUpdate(
        { estudiante: estudiante._id, cursoId: curso.id },
        {
            $setOnInsert: {
                curso: curso._id,
                fechaInscripcion: new Date(),
                leccionesCompletadas: [],
                progreso: 0,
                ultimoAcceso: new Date()
            }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const yaEstaba = (estudiante.cursosInscritos || []).some((c) => c.cursoId === curso.id);
    if (!yaEstaba) {
        await User.updateOne(
            { _id: estudiante._id },
            {
                $push: {
                    cursosInscritos: {
                        cursoId: curso.id,
                        fechaInscripcion: new Date(),
                        leccionesCompletadas: [],
                        progreso: 0
                    }
                }
            }
        );
    }

    return inscripcion;
}

/**
 * Guarda el progreso canónico y actualiza el espejo legado.
 * @returns {Promise<{inscripcion:Object, completadas:string[], total:number, progreso:number}>}
 */
async function guardarProgreso(estudianteId, curso, completadas, { ultimaLeccionId } = {}) {
    const lecciones = await obtenerLeccionesCurso(curso);
    const normalizadas = normalizarCompletadas(curso, completadas, lecciones);
    const total = lecciones.length;
    const progreso = calcularProgreso(total, normalizadas.length);

    const setCampos = {
        leccionesCompletadas: normalizadas,
        progreso,
        ultimoAcceso: new Date()
    };
    if (ultimaLeccionId !== undefined) {
        setCampos.ultimaLeccionId = String(ultimaLeccionId || '');
    }

    const inscripcion = await Enrollment.findOneAndUpdate(
        { estudiante: estudianteId, cursoId: curso.id },
        {
            $set: setCampos,
            $setOnInsert: {
                curso: curso._id,
                fechaInscripcion: new Date()
            }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Espejo legado: solo actualiza si el subdocumento ya existe.
    await User.updateOne(
        { _id: estudianteId, 'cursosInscritos.cursoId': curso.id },
        {
            $set: {
                'cursosInscritos.$.leccionesCompletadas': normalizadas,
                'cursosInscritos.$.progreso': progreso
            }
        }
    );

    return { inscripcion, completadas: normalizadas, total, progreso };
}

/**
 * Registra el segundo exacto de reproducción de un video para que el estudiante
 * pueda retomar donde se quedó.
 * @param {string|Object} estudianteId
 * @param {Object} curso
 * @param {{leccionId:string, bloqueId?:string, segundoActual:number, duracionSeg?:number, completado?:boolean}} datos
 */
async function guardarPosicionVideo(
    estudianteId,
    curso,
    { leccionId, bloqueId = 'principal', segundoActual = 0, duracionSeg = 0, completado }
) {
    const inscripcion = await obtenerInscripcion(estudianteId, curso);
    if (!inscripcion) return null;

    const lecKey = String(leccionId || '').trim();
    const blkKey = String(bloqueId || 'principal').trim();
    if (!lecKey) throw new Error('leccionId es obligatorio para guardar posición de video');

    const seg = Math.max(0, Math.round(Number(segundoActual) || 0));
    const dur = Math.max(0, Math.round(Number(duracionSeg) || 0));
    const autoCompleto = dur > 0 && seg / dur >= 0.9;

    if (!Array.isArray(inscripcion.progresoVideos)) {
        inscripcion.progresoVideos = [];
    }

    const existente = inscripcion.progresoVideos.find((v) => v.leccionId === lecKey && v.bloqueId === blkKey);
    if (existente) {
        existente.segundoActual = dur > 0 ? Math.min(seg, dur) : seg;
        if (dur > 0) existente.duracionSeg = dur;
        if (completado !== undefined) existente.completado = Boolean(completado);
        else if (autoCompleto) existente.completado = true;
        existente.actualizadoEn = new Date();
    } else {
        inscripcion.progresoVideos.push({
            leccionId: lecKey,
            bloqueId: blkKey,
            segundoActual: dur > 0 ? Math.min(seg, dur) : seg,
            duracionSeg: dur,
            completado: completado !== undefined ? Boolean(completado) : autoCompleto,
            actualizadoEn: new Date()
        });
    }

    inscripcion.ultimaLeccionId = lecKey;
    inscripcion.ultimoAcceso = new Date();
    await inscripcion.save();

    return inscripcion.progresoVideos.find((v) => v.leccionId === lecKey && v.bloqueId === blkKey);
}

/** Devuelve el progreso guardado de un video específico o null. */
function obtenerPosicionVideo(inscripcion, leccionId, bloqueId = 'principal') {
    if (!inscripcion || !Array.isArray(inscripcion.progresoVideos)) return null;
    return (
        inscripcion.progresoVideos.find(
            (v) => v.leccionId === String(leccionId) && v.bloqueId === String(bloqueId || 'principal')
        ) || null
    );
}

/**
 * Registra el resultado de un intento de quiz (de módulo o intercalado en una lección).
 * Conserva el mejor puntaje histórico y el contador de intentos.
 * @param {string|Object} estudianteId
 * @param {Object} curso
 * @param {{moduloId?:string, leccionId?:string, bloqueId?:string, puntaje:number, aprobado?:boolean, respuestas?:number[]}} datos
 */
async function registrarIntentoQuiz(
    estudianteId,
    curso,
    { moduloId = '', leccionId = '', bloqueId = '', puntaje = 0, aprobado, respuestas = [] }
) {
    const inscripcion = await obtenerInscripcion(estudianteId, curso);
    if (!inscripcion) return null;

    const modKey = String(moduloId || '').trim();
    const lecKey = String(leccionId || '').trim();
    const blkKey = String(bloqueId || '').trim();
    if (!modKey && !lecKey) {
        throw new Error('Debe indicarse moduloId o leccionId para registrar el quiz');
    }

    const pct = Math.min(100, Math.max(0, Math.round(Number(puntaje) || 0)));
    const esAprobado = aprobado !== undefined ? Boolean(aprobado) : pct >= 70;

    if (!Array.isArray(inscripcion.progresoQuizzes)) {
        inscripcion.progresoQuizzes = [];
    }

    const existente = inscripcion.progresoQuizzes.find(
        (q) => q.moduloId === modKey && q.leccionId === lecKey && q.bloqueId === blkKey
    );

    if (existente) {
        existente.puntaje = pct;
        existente.mejorPuntaje = Math.max(existente.mejorPuntaje || 0, pct);
        existente.aprobado = Boolean(existente.aprobado || esAprobado);
        existente.intentos = (existente.intentos || 1) + 1;
        existente.respuestas = Array.isArray(respuestas) ? respuestas : [];
        existente.fechaUltimoIntento = new Date();
    } else {
        inscripcion.progresoQuizzes.push({
            moduloId: modKey,
            leccionId: lecKey,
            bloqueId: blkKey,
            puntaje: pct,
            mejorPuntaje: pct,
            aprobado: esAprobado,
            intentos: 1,
            respuestas: Array.isArray(respuestas) ? respuestas : [],
            fechaUltimoIntento: new Date()
        });
    }

    inscripcion.ultimoAcceso = new Date();
    await inscripcion.save();

    return inscripcion.progresoQuizzes.find(
        (q) => q.moduloId === modKey && q.leccionId === lecKey && q.bloqueId === blkKey
    );
}

/** Indica si el curso está completo al 100 % con lecciones válidas. */
function estaCompleto(curso, completadas, listaLecciones) {
    const fuente = Array.isArray(listaLecciones) ? listaLecciones : obtenerLecciones(curso);
    const total = fuente.length;
    if (total === 0) return false;
    return normalizarCompletadas(curso, completadas, fuente).length === total;
}

/** Versión asíncrona de `estaCompleto` que consulta `Lesson` si `curso.modulos` no está cargado. */
async function estaCompletoAsync(curso, completadas) {
    const lecciones = await obtenerLeccionesCurso(curso);
    return estaCompleto(curso, completadas, lecciones);
}

module.exports = {
    obtenerLecciones,
    obtenerLeccionesCurso,
    claveLeccion,
    clavesValidas,
    normalizarCompletadas,
    calcularProgreso,
    obtenerInscripcion,
    crearInscripcion,
    guardarProgreso,
    guardarPosicionVideo,
    obtenerPosicionVideo,
    registrarIntentoQuiz,
    estaCompleto,
    estaCompletoAsync
};
