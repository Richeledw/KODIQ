/**
 * @file migrateContent.js
 * @description Migra los cursos con módulos/lecciones embebidos (esquema v1) a las
 * colecciones `modules` y `lessons` con bloques de contenido (esquema v2).
 *
 * Es idempotente y conserva los slugs de las lecciones (el progreso no se pierde).
 * El array original queda como `modulosLegacy` en cada curso por si hay que revertir.
 *
 *   node scripts/migrateContent.js            # simulación (no escribe)
 *   node scripts/migrateContent.js --apply    # aplica los cambios
 *
 * Nota: el servidor también ejecuta esta migración automáticamente al arrancar.
 */

require('dotenv').config();
const os = require('os');
const mongoose = require('mongoose');
const { migrarContenidoPendiente } = require('../src/services/contentMigration');

const APLICAR = process.argv.includes('--apply');

(async () => {
    try {
        if (!process.env.MONGO_URI) throw new Error('Falta MONGO_URI en .env');
        await mongoose.connect(process.env.MONGO_URI, { runtimeAdapters: { os } });

        console.log(`Modo: ${APLICAR ? 'APLICAR' : 'SIMULACIÓN (sin cambios)'}`);
        const resumen = await migrarContenidoPendiente({ dryRun: !APLICAR, log: (m) => console.log(' -', m) });

        console.log('\nResumen:');
        console.log(`  Cursos procesados : ${resumen.cursos}`);
        console.log(`  Módulos creados   : ${resumen.modulos}`);
        console.log(`  Lecciones creadas : ${resumen.lecciones}`);
        console.log(`  Ya existentes     : ${resumen.omitidas}`);
        console.log(`  Errores           : ${resumen.errores.length}`);
        if (!APLICAR) console.log('\nEjecuta con --apply para escribir los cambios.');

        await mongoose.disconnect();
        process.exit(resumen.errores.length ? 1 : 0);
    } catch (err) {
        console.error('Error en la migración:', err.message);
        await mongoose.disconnect().catch(() => {});
        process.exit(1);
    }
})();
