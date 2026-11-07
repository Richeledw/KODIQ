/**
 * @file progressService.js
 * @description Fuente única del progreso académico.
 *
 * Decision de diseno:
 *  - `Enrollment` es la fuente de verdad (una inscripcion por estudiante/curso).
 *  - `User.cursosInscritos` se conserva como espejo legado para no romper datos
 *    ni codigo antiguo; se rellena automaticamente la primera vez que se lee.
 *  - Las lecciones se identifican por su slug `leccion.id`, que es el valor que
 *    ya estaba persistido en el progreso historico. Las rutas nuevas usan `_id`
 *    para localizar modulos/lecciones, pero el progreso sigue siendo estable
 *    aunque se reordenen los arrays.
 */

const Enrollment = require('../models/Enrollment');
const User = require('../models/User');

/** Aplana los modulos del curso en una lista de lecciones con su modulo. */
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

/** Clave estable de una leccion para el progreso (slug `id`). */
function claveLeccion(leccion) {
    if (!leccion) return '';
    return String(leccion.id || leccion._id || '');
}

/** Conjunto de claves validas del curso. */
function clavesValidas(curso) {
    return new Set(obtenerLecciones(curso).map(claveLeccion).filter(Boolean));
}

/**
 * Elimina IDs inexistentes, duplicados y valores no string.
 * Evita que un progreso viejo o manipulado supere el 100 %.
 */
function normalizarCompletadas(curso, completadas) {
    const validas = clavesValidas(curso);
    const unicas = new Set();

    (Array.isArray(completadas) ? completadas : []).forEach((valor) => {
        const clave = String(valor || '');
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
 * Devuelve la inscripcion canonica del estudiante en el curso.
 * Si solo existe el registro legado en `User.cursosInscritos`, lo migra de
 * forma perezosa a `Enrollment` y devuelve la inscripcion nueva.
 */
async function obtenerInscripcion(estudianteId, curso) {
    if (!estudianteId || !curso) return null;

    let inscripcion = await Enrollment.findOne({
        estudiante: estudianteId,
        cursoId: curso.id
    });

    if (inscripcion) {
        const completadas = normalizarCompletadas(curso, inscripcion.leccionesCompletadas);
        const total = obtenerLecciones(curso).length;
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

    // Migracion perezosa desde el modelo legado.
    const usuario = await User.findById(estudianteId).select('cursosInscritos');
    const legado =
        usuario && usuario.cursosInscritos ? usuario.cursosInscritos.find((c) => c.cursoId === curso.id) : null;

    if (!legado) return null;

    const completadas = normalizarCompletadas(curso, legado.leccionesCompletadas);
    const total = obtenerLecciones(curso).length;

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
        // Otro request pudo crearla entre la lectura y la escritura.
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
 * Crea la inscripcion si no existe (inscripcion explicita) y sincroniza el
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
 * Guarda el progreso canonico y actualiza el espejo legado.
 * @returns {{inscripcion:Object, completadas:string[], total:number, progreso:number}}
 */
async function guardarProgreso(estudianteId, curso, completadas) {
    const normalizadas = normalizarCompletadas(curso, completadas);
    const total = obtenerLecciones(curso).length;
    const progreso = calcularProgreso(total, normalizadas.length);

    const inscripcion = await Enrollment.findOneAndUpdate(
        { estudiante: estudianteId, cursoId: curso.id },
        {
            $set: {
                leccionesCompletadas: normalizadas,
                progreso,
                ultimoAcceso: new Date()
            },
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

/** Indica si el curso esta completo al 100 % con lecciones validas. */
function estaCompleto(curso, completadas) {
    const total = obtenerLecciones(curso).length;
    if (total === 0) return false;
    return normalizarCompletadas(curso, completadas).length === total;
}

module.exports = {
    obtenerLecciones,
    claveLeccion,
    clavesValidas,
    normalizarCompletadas,
    calcularProgreso,
    obtenerInscripcion,
    crearInscripcion,
    guardarProgreso,
    estaCompleto
};
