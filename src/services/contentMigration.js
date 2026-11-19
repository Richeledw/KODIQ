/**
 * @file contentMigration.js
 * @description Migración del contenido embebido (v1: `Course.modulos[].lecciones[]`)
 * a las colecciones normalizadas `Module` y `Lesson` (v2, con bloques de contenido).
 *
 * Garantías:
 *  - Idempotente: conserva los `_id` originales de módulos y lecciones y el slug `id`
 *    de cada lección, así que puede ejecutarse varias veces sin duplicar nada.
 *  - No pierde el progreso: `Enrollment.leccionesCompletadas` sigue apuntando a los mismos slugs.
 *  - Reversible: el array original se conserva renombrado como `modulosLegacy`
 *    (puede borrarse manualmente cuando se confirme que todo está bien).
 *
 * Se ejecuta automáticamente al conectar la base de datos y también con
 * `node scripts/migrateContent.js`.
 */

const Course = require('../models/Course');
const contentService = require('./contentService');

/** Cursos que aún tienen el array `modulos` embebido. */
function buscarCursosPendientes() {
    return Course.collection.find({ modulos: { $exists: true } }).toArray();
}

/**
 * Migra un curso en formato crudo (leído directamente de la colección).
 * @param {object} raw Documento crudo con `modulos`
 * @param {{dryRun?:boolean}} [opciones]
 */
async function migrarCurso(raw, { dryRun = false } = {}) {
    const modulos = Array.isArray(raw.modulos) ? raw.modulos : [];
    const totalLecciones = modulos.reduce((acc, m) => acc + (m.lecciones || []).length, 0);

    if (dryRun) {
        return { curso: raw.id, modulos: modulos.length, lecciones: totalLecciones, omitidas: 0, simulado: true };
    }

    const curso = await Course.findById(raw._id);
    if (!curso) return { curso: raw.id, modulos: 0, lecciones: 0, omitidas: 0 };

    const resumen = await contentService.importarModulos(curso, modulos);

    await Course.collection.updateOne(
        { _id: raw._id },
        { $rename: { modulos: 'modulosLegacy' }, $set: { versionContenido: 2 } }
    );

    return { curso: raw.id, ...resumen };
}

/**
 * Migra todos los cursos pendientes.
 * @param {{dryRun?:boolean, log?:(msg:string)=>void}} [opciones]
 * @returns {Promise<{cursos:number, modulos:number, lecciones:number, omitidas:number, errores:object[]}>}
 */
async function migrarContenidoPendiente({ dryRun = false, log = () => {} } = {}) {
    const pendientes = await buscarCursosPendientes();
    const total = { cursos: 0, modulos: 0, lecciones: 0, omitidas: 0, errores: [] };

    for (const raw of pendientes) {
        try {
            const r = await migrarCurso(raw, { dryRun });
            total.cursos++;
            total.modulos += r.modulos;
            total.lecciones += r.lecciones;
            total.omitidas += r.omitidas;
            log(
                `${dryRun ? '[simulación] ' : ''}Curso "${raw.id}": ${r.modulos} módulos, ${r.lecciones} lecciones` +
                    (r.omitidas ? ` (${r.omitidas} ya existían)` : '')
            );
        } catch (err) {
            total.errores.push({ curso: raw.id, error: err.message });
            log(`Error migrando "${raw.id}": ${err.message}`);
        }
    }

    // Cursos v1 sin módulos: solo marcar la versión.
    if (!dryRun) {
        await Course.collection.updateMany({ versionContenido: { $exists: false } }, { $set: { versionContenido: 2 } });
    }

    return total;
}

module.exports = { buscarCursosPendientes, migrarCurso, migrarContenidoPendiente };
