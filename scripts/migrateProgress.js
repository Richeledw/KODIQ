/**
 * @file migrateProgress.js
 * @description Migra el progreso legado de `User.cursosInscritos` a `Enrollment`.
 *
 * Es idempotente: se puede ejecutar varias veces sin duplicar inscripciones.
 * Por defecto solo simula (`--dry-run`). Para escribir de verdad:
 *
 *   node scripts/migrateProgress.js --dry-run
 *   node scripts/migrateProgress.js --apply
 *
 * No imprime correos ni contraseñas; solo un resumen agregado.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Enrollment = require('../src/models/Enrollment');
const progressService = require('../src/services/progressService');

const APLICAR = process.argv.includes('--apply');
const MODO = APLICAR ? 'APLICAR' : 'DRY-RUN (sin cambios)';

const limitarProgreso = (valor) => Math.min(100, Math.max(0, Number(valor) || 0));

(async () => {
    try {
        if (!process.env.MONGO_URI) throw new Error('Falta MONGO_URI en .env');

        await mongoose.connect(process.env.MONGO_URI);

        const cursos = await Course.find().lean();
        const cursosPorId = new Map(cursos.map((curso) => [curso.id, curso]));

        const usuarios = await User.find({ 'cursosInscritos.0': { $exists: true } }).select('cursosInscritos');

        const resumen = {
            usuarios: usuarios.length,
            inscripcionesLegado: 0,
            creadas: 0,
            actualizadas: 0,
            sinCambios: 0,
            cursosSinLecciones: 0
        };

        for (const usuario of usuarios) {
            for (const legado of usuario.cursosInscritos || []) {
                resumen.inscripcionesLegado += 1;

                const curso = cursosPorId.get(legado.cursoId) || { id: legado.cursoId, modulos: [] };
                const total = progressService.obtenerLecciones(curso).length;
                if (total === 0) resumen.cursosSinLecciones += 1;

                const completadasLegado = progressService.normalizarCompletadas(curso, legado.leccionesCompletadas);

                const existente = await Enrollment.findOne({
                    estudiante: usuario._id,
                    cursoId: legado.cursoId
                });

                if (!existente) {
                    const progreso =
                        total > 0
                            ? progressService.calcularProgreso(total, completadasLegado.length)
                            : limitarProgreso(legado.progreso);

                    if (APLICAR) {
                        await Enrollment.create({
                            estudiante: usuario._id,
                            curso: curso._id,
                            cursoId: legado.cursoId,
                            fechaInscripcion: legado.fechaInscripcion || new Date(),
                            leccionesCompletadas: completadasLegado,
                            progreso,
                            ultimoAcceso: new Date()
                        });
                    }
                    resumen.creadas += 1;
                    continue;
                }

                // Si ya existe, unimos ambos conjuntos para no perder avance.
                const completadas = progressService.normalizarCompletadas(curso, [
                    ...(existente.leccionesCompletadas || []),
                    ...completadasLegado
                ]);
                const progreso =
                    total > 0
                        ? progressService.calcularProgreso(total, completadas.length)
                        : limitarProgreso(existente.progreso);

                const cambia =
                    completadas.length !== (existente.leccionesCompletadas || []).length ||
                    progreso !== existente.progreso;

                if (cambia) {
                    if (APLICAR) {
                        existente.leccionesCompletadas = completadas;
                        existente.progreso = progreso;
                        existente.ultimoAcceso = new Date();
                        await existente.save();
                    }
                    resumen.actualizadas += 1;
                } else {
                    resumen.sinCambios += 1;
                }
            }
        }

        console.log(`\nMigración de progreso — modo: ${MODO}`);
        console.log(`Usuarios con inscripciones legadas: ${resumen.usuarios}`);
        console.log(`Inscripciones legadas revisadas:     ${resumen.inscripcionesLegado}`);
        console.log(`Enrollment a crear:                  ${resumen.creadas}`);
        console.log(`Enrollment a actualizar:             ${resumen.actualizadas}`);
        console.log(`Sin cambios:                         ${resumen.sinCambios}`);
        console.log(`Cursos sin lecciones en BD:          ${resumen.cursosSinLecciones}`);

        if (!APLICAR) {
            console.log('\nNo se escribió nada. Ejecuta con --apply para aplicar los cambios.');
        }
    } catch (err) {
        console.error('\nError en la migración:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
})();
