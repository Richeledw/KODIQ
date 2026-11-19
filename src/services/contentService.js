/**
 * @file contentService.js
 * @description Capa de acceso al contenido de los cursos (módulos, lecciones y bloques)
 * sobre las colecciones normalizadas `Module` y `Lesson`.
 *
 * Además de las operaciones CRUD, ofrece un "adaptador" que reconstruye la forma
 * clásica `curso.modulos[].lecciones[]` (con `videoUrl`, `explicacionDetallada`,
 * `codigoEjemplo`, `recursos`...) para que las vistas y servicios existentes sigan
 * funcionando mientras la interfaz se actualiza para usar bloques.
 *
 * Rendimiento:
 *  - `cargarCursoCompleto()` por defecto NO trae los bloques (solo el temario).
 *  - `cargarLeccion()` trae una sola lección con todos sus bloques.
 *  - `cargarTemarios()` resuelve varios cursos con 2 consultas en total.
 */

const crypto = require('crypto');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const MediaAsset = require('../models/MediaAsset');

const { TIPOS_BLOQUE } = Lesson;
const esObjectId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v || ''));

class ContentError extends Error {
    constructor(mensaje, status = 400) {
        super(mensaje);
        this.name = 'ContentError';
        this.status = status;
    }
}

// ════════════════════════════════════════════════════════════════════════════
// Resolución de entidades
// ════════════════════════════════════════════════════════════════════════════

/** Acepta un documento Course, su slug `id` o su `_id`. */
async function resolverCurso(cursoOSlug) {
    if (cursoOSlug && cursoOSlug._id && cursoOSlug.id) return cursoOSlug;
    const valor = String(cursoOSlug || '').trim();
    const curso = await Course.findOne(esObjectId(valor) ? { $or: [{ id: valor }, { _id: valor }] } : { id: valor });
    if (!curso) throw new ContentError('Curso no encontrado', 404);
    return curso;
}

function obtenerModulos(curso, { soloPublicado = false } = {}) {
    const filtro = { curso: curso._id };
    if (soloPublicado) filtro.publicado = { $ne: false };
    return Module.find(filtro).sort({ orden: 1, _id: 1 });
}

/** Busca un módulo por `_id` o por índice (compatibilidad con rutas antiguas). */
async function resolverModulo(curso, moduloId) {
    if (esObjectId(moduloId)) {
        const modulo = await Module.findOne({ _id: moduloId, curso: curso._id });
        if (modulo) return modulo;
    }
    if (/^\d+$/.test(String(moduloId))) {
        const modulos = await obtenerModulos(curso);
        if (modulos[Number(moduloId)]) return modulos[Number(moduloId)];
    }
    throw new ContentError('Módulo no encontrado', 404);
}

/** Busca una lección por su slug `id` o por `_id` dentro del curso. */
async function resolverLeccion(curso, leccionKey) {
    const clave = String(leccionKey || '');
    const or = [{ id: clave }];
    if (esObjectId(clave)) or.push({ _id: clave });
    const leccion = await Lesson.findOne({ curso: curso._id, $or: or });
    if (!leccion) throw new ContentError('Lección no encontrada', 404);
    return leccion;
}

/** Slug único y estable para una lección nueva. */
function generarIdLeccion(cursoSlug) {
    return `${cursoSlug}-${crypto.randomBytes(4).toString('hex')}`;
}

// ════════════════════════════════════════════════════════════════════════════
// Conversión de formato clásico a bloques
// ════════════════════════════════════════════════════════════════════════════

/**
 * Convierte los campos de una lección clásica en bloques.
 * @param {{videoUrl?:string, explicacionDetallada?:string, codigoEjemplo?:string, lenguajeCodigo?:string}} datos
 */
function bloquesDesdeLegado({ videoUrl, explicacionDetallada, codigoEjemplo, lenguajeCodigo } = {}) {
    const bloques = [];
    if (videoUrl && String(videoUrl).trim()) bloques.push({ tipo: 'video', url: String(videoUrl).trim() });
    if (explicacionDetallada && String(explicacionDetallada).trim()) {
        bloques.push({ tipo: 'texto', formato: 'markdown', contenido: String(explicacionDetallada).trim() });
    }
    if (codigoEjemplo && String(codigoEjemplo).trim()) {
        bloques.push({ tipo: 'codigo', lenguaje: lenguajeCodigo || 'javascript', contenido: String(codigoEjemplo) });
    }
    return bloques;
}

/** Normaliza un bloque recibido desde formularios/JSON: solo campos conocidos. */
function limpiarBloque(bloque) {
    if (!bloque || typeof bloque !== 'object') throw new ContentError('Bloque no válido');
    const tipo = String(bloque.tipo || '');
    if (!TIPOS_BLOQUE.includes(tipo)) throw new ContentError(`Tipo de bloque no válido: "${tipo}"`);

    const permitidos = {
        texto: ['formato', 'contenido'],
        video: ['proveedor', 'url', 'asset', 'duracionSeg', 'transcripcion', 'capitulos', 'subtitulos'],
        codigo: ['lenguaje', 'nombreArchivo', 'contenido'],
        archivo: ['asset', 'url', 'descripcion'],
        imagen: ['asset', 'url', 'alt', 'pie'],
        embed: ['url', 'alto'],
        aviso: ['variante', 'contenido'],
        quiz: ['preguntas', 'puntajeMinimo', 'explicacionGeneral']
    }[tipo];

    const limpio = { tipo };
    if (bloque.titulo !== undefined) limpio.titulo = String(bloque.titulo);
    permitidos.forEach((campo) => {
        if (bloque[campo] !== undefined && bloque[campo] !== null && bloque[campo] !== '') {
            limpio[campo] = campo === 'asset' ? String(bloque[campo]) : bloque[campo];
        }
    });
    if (bloque._id && esObjectId(bloque._id)) limpio._id = bloque._id;
    return limpio;
}

/**
 * Comprueba que todos los archivos referenciados pertenecen al curso.
 * Evita que un docente incruste archivos privados de otro curso.
 */
async function verificarAssets(curso, bloques = [], recursos = []) {
    const ids = new Set();
    [...bloques, ...recursos].forEach((b) => {
        if (!b) return;
        if (b.asset) ids.add(String(b.asset));
        if (Array.isArray(b.subtitulos)) {
            b.subtitulos.forEach((s) => {
                if (s && s.asset) ids.add(String(s.asset));
            });
        }
    });
    if (ids.size === 0) return;
    for (const id of ids) {
        if (!esObjectId(id)) throw new ContentError('Identificador de archivo no válido');
    }
    const encontrados = await MediaAsset.countDocuments({ _id: { $in: [...ids] }, curso: curso._id });
    if (encontrados !== ids.size) {
        throw new ContentError('Uno o más archivos no existen o no pertenecen a este curso.', 403);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// Módulos
// ════════════════════════════════════════════════════════════════════════════

async function siguienteOrden(Modelo, filtro) {
    const ultimo = await Modelo.findOne(filtro).sort({ orden: -1 }).select('orden').lean();
    return (ultimo ? ultimo.orden || 0 : 0) + 1;
}

async function crearModulo(cursoOSlug, { titulo, descripcion, quiz, publicado } = {}) {
    const curso = await resolverCurso(cursoOSlug);
    const modulo = await Module.create({
        curso: curso._id,
        cursoId: curso.id,
        titulo: String(titulo || '').trim(),
        descripcion: descripcion ? String(descripcion).trim() : '',
        orden: await siguienteOrden(Module, { curso: curso._id }),
        publicado: publicado !== false,
        quiz: Array.isArray(quiz) ? quiz : []
    });
    await recalcularEstadisticas(curso);
    return modulo;
}

async function actualizarModulo(cursoOSlug, moduloId, cambios = {}) {
    const curso = await resolverCurso(cursoOSlug);
    const modulo = await resolverModulo(curso, moduloId);
    ['titulo', 'descripcion', 'publicado', 'quiz'].forEach((campo) => {
        if (cambios[campo] !== undefined) modulo[campo] = cambios[campo];
    });
    await modulo.save();
    return modulo;
}

/** Elimina un módulo y todas sus lecciones. */
async function eliminarModulo(cursoOSlug, moduloId) {
    const curso = await resolverCurso(cursoOSlug);
    const modulo = await resolverModulo(curso, moduloId);
    await Lesson.deleteMany({ modulo: modulo._id });
    await modulo.deleteOne();
    await recalcularEstadisticas(curso);
    return modulo;
}

/** Aplica el orden indicado (lista de `_id` de módulos). */
async function reordenarModulos(cursoOSlug, idsOrdenados = []) {
    const curso = await resolverCurso(cursoOSlug);
    const ops = idsOrdenados
        .filter(esObjectId)
        .map((id, i) => ({ updateOne: { filter: { _id: id, curso: curso._id }, update: { $set: { orden: i + 1 } } } }));
    if (ops.length) await Module.bulkWrite(ops);
    return obtenerModulos(curso);
}

// ════════════════════════════════════════════════════════════════════════════
// Lecciones
// ════════════════════════════════════════════════════════════════════════════

/**
 * Crea una lección. Acepta `bloques` (formato nuevo) o los campos clásicos
 * `videoUrl`, `explicacionDetallada`, `codigoEjemplo` y `lenguajeCodigo`.
 */
async function crearLeccion(cursoOSlug, moduloId, datos = {}) {
    const curso = await resolverCurso(cursoOSlug);
    const modulo = await resolverModulo(curso, moduloId);

    const bloques = Array.isArray(datos.bloques) ? datos.bloques.map(limpiarBloque) : bloquesDesdeLegado(datos);
    const recursos = Array.isArray(datos.recursos) ? datos.recursos : [];
    await verificarAssets(curso, bloques, recursos);

    const idDeseado = datos.id ? String(datos.id).trim() : '';
    if (idDeseado && (await Lesson.exists({ curso: curso._id, id: idDeseado }))) {
        throw new ContentError(`Ya existe una lección con el identificador "${idDeseado}" en este curso.`, 409);
    }

    const leccion = new Lesson({
        curso: curso._id,
        cursoId: curso.id,
        modulo: modulo._id,
        id: idDeseado || generarIdLeccion(curso.id),
        titulo: String(datos.titulo || '').trim(),
        descripcion: datos.descripcion ? String(datos.descripcion).trim() : '',
        duracion: datos.duracion ? String(datos.duracion).trim() : '15 min',
        orden: await siguienteOrden(Lesson, { modulo: modulo._id }),
        publicado: datos.publicado !== false,
        vistaPrevia: Boolean(datos.vistaPrevia),
        bloques,
        recursos
    });
    await leccion.save();
    await recalcularEstadisticas(curso);
    return leccion;
}

/** Actualiza los datos generales de una lección (y opcionalmente reemplaza sus bloques). */
async function actualizarLeccion(cursoOSlug, leccionKey, cambios = {}) {
    const curso = await resolverCurso(cursoOSlug);
    const leccion = await resolverLeccion(curso, leccionKey);

    ['titulo', 'descripcion', 'duracion', 'publicado', 'vistaPrevia'].forEach((campo) => {
        if (cambios[campo] !== undefined) leccion[campo] = cambios[campo];
    });
    if (Array.isArray(cambios.bloques)) {
        const bloques = cambios.bloques.map(limpiarBloque);
        await verificarAssets(curso, bloques);
        leccion.bloques = bloques;
    }
    if (Array.isArray(cambios.recursos)) {
        await verificarAssets(curso, [], cambios.recursos);
        leccion.recursos = cambios.recursos;
    }
    await leccion.save();
    await recalcularEstadisticas(curso);
    return leccion;
}

async function eliminarLeccion(cursoOSlug, moduloId, leccionKey) {
    const curso = await resolverCurso(cursoOSlug);
    const modulo = await resolverModulo(curso, moduloId);

    let leccion = null;
    try {
        leccion = await resolverLeccion(curso, leccionKey);
    } catch (_e) {
        // Compatibilidad: índice numérico dentro del módulo
        if (/^\d+$/.test(String(leccionKey))) {
            const lista = await Lesson.find({ modulo: modulo._id }).sort({ orden: 1, _id: 1 });
            leccion = lista[Number(leccionKey)] || null;
        }
    }
    if (!leccion || String(leccion.modulo) !== String(modulo._id)) throw new ContentError('Lección no encontrada', 404);

    await leccion.deleteOne();
    await recalcularEstadisticas(curso);
    return leccion;
}

/** Mueve una lección a otro módulo (al final o en la posición indicada, base 0). */
async function moverLeccion(cursoOSlug, leccionKey, moduloDestinoId, posicion) {
    const curso = await resolverCurso(cursoOSlug);
    const leccion = await resolverLeccion(curso, leccionKey);
    const destino = await resolverModulo(curso, moduloDestinoId);

    const hermanas = await Lesson.find({ modulo: destino._id, _id: { $ne: leccion._id } })
        .sort({ orden: 1, _id: 1 })
        .select('_id');
    const ids = hermanas.map((h) => String(h._id));
    const pos = Number.isInteger(posicion) ? Math.min(Math.max(posicion, 0), ids.length) : ids.length;
    ids.splice(pos, 0, String(leccion._id));

    leccion.modulo = destino._id;
    await leccion.save();
    await Lesson.bulkWrite(
        ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { orden: i + 1 } } } }))
    );
    return Lesson.findById(leccion._id);
}

/** Reordena las lecciones de un módulo según la lista de `_id` o slugs recibida. */
async function reordenarLecciones(cursoOSlug, moduloId, clavesOrdenadas = []) {
    const curso = await resolverCurso(cursoOSlug);
    const modulo = await resolverModulo(curso, moduloId);
    const lecciones = await Lesson.find({ modulo: modulo._id }).select('_id id');
    const porClave = new Map();
    lecciones.forEach((l) => {
        porClave.set(String(l._id), l._id);
        porClave.set(String(l.id), l._id);
    });
    const ops = clavesOrdenadas
        .map((k) => porClave.get(String(k)))
        .filter(Boolean)
        .map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { orden: i + 1 } } } }));
    if (ops.length) await Lesson.bulkWrite(ops);
    return Lesson.find({ modulo: modulo._id }).sort({ orden: 1 }).select('-bloques');
}

// ════════════════════════════════════════════════════════════════════════════
// Bloques de contenido
// ════════════════════════════════════════════════════════════════════════════

/** Inserta un bloque al final o en `posicion` (base 0). */
async function agregarBloque(cursoOSlug, leccionKey, bloque, posicion) {
    const curso = await resolverCurso(cursoOSlug);
    const leccion = await resolverLeccion(curso, leccionKey);
    const limpio = limpiarBloque(bloque);
    delete limpio._id;
    await verificarAssets(curso, [limpio]);

    const pos = Number.isInteger(posicion) ? Math.min(Math.max(posicion, 0), leccion.bloques.length) : undefined;
    if (pos === undefined) leccion.bloques.push(limpio);
    else leccion.bloques.splice(pos, 0, limpio);

    await leccion.save();
    await recalcularEstadisticas(curso);
    return leccion;
}

async function actualizarBloque(cursoOSlug, leccionKey, bloqueId, cambios = {}) {
    const curso = await resolverCurso(cursoOSlug);
    const leccion = await resolverLeccion(curso, leccionKey);
    const indice = leccion.bloques.findIndex((b) => String(b._id) === String(bloqueId));
    if (indice === -1) throw new ContentError('Bloque no encontrado', 404);

    const actual = leccion.bloques[indice].toObject();
    const limpio = limpiarBloque({ ...actual, ...cambios, tipo: actual.tipo, _id: actual._id });
    await verificarAssets(curso, [limpio]);
    leccion.bloques.splice(indice, 1, limpio);

    await leccion.save();
    await recalcularEstadisticas(curso);
    return leccion;
}

async function eliminarBloque(cursoOSlug, leccionKey, bloqueId) {
    const curso = await resolverCurso(cursoOSlug);
    const leccion = await resolverLeccion(curso, leccionKey);
    const indice = leccion.bloques.findIndex((b) => String(b._id) === String(bloqueId));
    if (indice === -1) throw new ContentError('Bloque no encontrado', 404);
    leccion.bloques.splice(indice, 1);
    await leccion.save();
    await recalcularEstadisticas(curso);
    return leccion;
}

/** Reordena los bloques según la lista de `_id`. Los no listados quedan al final. */
async function reordenarBloques(cursoOSlug, leccionKey, idsOrdenados = []) {
    const curso = await resolverCurso(cursoOSlug);
    const leccion = await resolverLeccion(curso, leccionKey);
    const posicion = new Map(idsOrdenados.map((id, i) => [String(id), i]));
    const ordenados = leccion.bloques
        .map((b) => b.toObject())
        .sort((a, b) => (posicion.get(String(a._id)) ?? 1e9) - (posicion.get(String(b._id)) ?? 1e9));
    leccion.bloques = ordenados;
    await leccion.save();
    return leccion;
}

// ════════════════════════════════════════════════════════════════════════════
// Estadísticas desnormalizadas
// ════════════════════════════════════════════════════════════════════════════

async function recalcularEstadisticas(cursoOSlug) {
    const curso = await resolverCurso(cursoOSlug);
    const [modulos, agregado, archivos] = await Promise.all([
        Module.countDocuments({ curso: curso._id }),
        Lesson.aggregate([
            { $match: { curso: curso._id } },
            { $group: { _id: null, lecciones: { $sum: 1 }, minutos: { $sum: '$duracionMin' } } }
        ]),
        MediaAsset.countDocuments({ curso: curso._id })
    ]);
    const estadisticas = {
        modulos,
        lecciones: agregado[0] ? agregado[0].lecciones : 0,
        minutos: agregado[0] ? agregado[0].minutos : 0,
        archivos
    };
    await Course.updateOne({ _id: curso._id }, { $set: { estadisticas } });
    if (typeof curso.set === 'function') curso.set('estadisticas', estadisticas);
    return estadisticas;
}

// ════════════════════════════════════════════════════════════════════════════
// Lectura y adaptador de compatibilidad
// ════════════════════════════════════════════════════════════════════════════

const aPlano = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);

/** URL utilizable para un recurso o bloque con archivo propio. */
function urlDe(item) {
    if (!item) return '';
    if (item.url) return item.url;
    if (item.asset) return `/media/${item.asset._id || item.asset}`;
    return '';
}

function adaptarRecurso(r) {
    const plano = aPlano(r);
    return { ...plano, url: urlDe(plano) };
}

/**
 * Añade a una lección los campos clásicos que usan las vistas actuales.
 * @param {object} leccion Documento o objeto plano de Lesson
 * @param {{completa?:boolean}} opciones `completa` = la lección incluye sus bloques
 */
function adaptarLeccion(leccion, { completa = false } = {}) {
    const l = aPlano(leccion);
    const bloques = Array.isArray(l.bloques) ? l.bloques : [];
    const recursos = (l.recursos || []).map(adaptarRecurso);

    let explicacionDetallada = l.resumen || '';
    let codigoEjemplo = '';
    let lenguajeCodigo = 'javascript';

    if (completa) {
        explicacionDetallada = bloques
            .filter((b) => b.tipo === 'texto' && b.contenido)
            .map((b) => (b.titulo ? `### ${b.titulo}\n${b.contenido}` : b.contenido))
            .join('\n\n');
        const codigo = bloques.find((b) => b.tipo === 'codigo' && b.contenido);
        if (codigo) {
            codigoEjemplo = codigo.contenido;
            lenguajeCodigo = codigo.lenguaje || 'javascript';
        }
        bloques
            .filter((b) => b.tipo === 'archivo')
            .forEach((b) =>
                recursos.push({
                    _id: b._id,
                    titulo: b.titulo || 'Archivo de la lección',
                    tipo: 'archivo',
                    url: urlDe(b),
                    asset: b.asset,
                    descripcion: b.descripcion || ''
                })
            );
        // Asegura que las URLs de bloques y subtítulos con archivo propio sean utilizables directamente.
        l.bloques = bloques.map((b) => {
            const copia = b.asset && !b.url ? { ...b, url: urlDe(b) } : { ...b };
            if (Array.isArray(copia.subtitulos)) {
                copia.subtitulos = copia.subtitulos.map((s) => (s.asset && !s.url ? { ...s, url: urlDe(s) } : s));
            }
            return copia;
        });
    }

    return {
        ...l,
        videoUrl: l.videoPrincipal || '',
        explicacionDetallada,
        codigoEjemplo,
        lenguajeCodigo,
        recursos
    };
}

/** Construye la forma `{...curso, modulos:[{...modulo, lecciones:[...]}]}`. */
function ensamblar(curso, modulos, lecciones, { completa = false } = {}) {
    const porModulo = new Map();
    lecciones.forEach((l) => {
        const clave = String(l.modulo);
        if (!porModulo.has(clave)) porModulo.set(clave, []);
        porModulo.get(clave).push(adaptarLeccion(l, { completa }));
    });

    const plano = aPlano(curso);
    return {
        ...plano,
        recursosGlobales: (plano.recursosGlobales || []).map(adaptarRecurso),
        modulos: modulos.map((m) => ({ ...aPlano(m), lecciones: porModulo.get(String(m._id)) || [] }))
    };
}

/**
 * Curso con su temario completo en la forma clásica.
 * @param {string|object} cursoOSlug
 * @param {{incluirBloques?:boolean, soloPublicado?:boolean}} [opciones]
 * @returns {Promise<object|null>} objeto plano o null si el curso no existe
 */
async function cargarCursoCompleto(cursoOSlug, { incluirBloques = false, soloPublicado = false } = {}) {
    let curso;
    try {
        curso = await resolverCurso(cursoOSlug);
    } catch (err) {
        if (err.status === 404) return null;
        throw err;
    }

    const filtroLecciones = { curso: curso._id };
    if (soloPublicado) filtroLecciones.publicado = { $ne: false };

    const [modulos, lecciones] = await Promise.all([
        obtenerModulos(curso, { soloPublicado }).lean(),
        Lesson.find(filtroLecciones)
            .select(incluirBloques ? '' : '-bloques')
            .sort({ orden: 1, _id: 1 })
            .lean()
    ]);

    return ensamblar(curso, modulos, lecciones, { completa: incluirBloques });
}

/**
 * Temario (sin bloques) de varios cursos con solo 2 consultas.
 * @param {object[]} cursos Documentos Course
 * @returns {Promise<Map<string, object>>} slug -> curso con `modulos`
 */
async function cargarTemarios(cursos, { soloPublicado = false } = {}) {
    const lista = (cursos || []).filter((c) => c && c._id);
    const ids = lista.map((c) => c._id);
    const filtro = { curso: { $in: ids } };
    if (soloPublicado) filtro.publicado = { $ne: false };

    const [modulos, lecciones] = await Promise.all([
        Module.find(filtro).sort({ orden: 1, _id: 1 }).lean(),
        Lesson.find(filtro).select('-bloques').sort({ orden: 1, _id: 1 }).lean()
    ]);

    const resultado = new Map();
    lista.forEach((c) => {
        const mods = modulos.filter((m) => String(m.curso) === String(c._id));
        const lecs = lecciones.filter((l) => String(l.curso) === String(c._id));
        resultado.set(c.id, ensamblar(c, mods, lecs));
    });
    return resultado;
}

/**
 * Una lección completa (con bloques) adaptada a la forma clásica, o null.
 * @param {string|object} cursoOSlug
 * @param {string} leccionKey slug `id` o `_id`
 */
async function cargarLeccion(cursoOSlug, leccionKey) {
    try {
        const curso = await resolverCurso(cursoOSlug);
        const leccion = await resolverLeccion(curso, leccionKey);
        const modulo = await Module.findById(leccion.modulo).select('titulo').lean();
        return {
            ...adaptarLeccion(leccion.toObject(), { completa: true }),
            moduloId: String(leccion.modulo),
            moduloTitulo: modulo ? modulo.titulo : ''
        };
    } catch (err) {
        if (err.status === 404) return null;
        throw err;
    }
}

// ════════════════════════════════════════════════════════════════════════════
// Importación (seed, migración, tests) y borrado en cascada
// ════════════════════════════════════════════════════════════════════════════

/**
 * Crea módulos y lecciones de un curso a partir del formato anidado
 * (`[{titulo, lecciones:[...]}]`). Las lecciones pueden venir en formato
 * clásico o con `bloques`. Es idempotente si se conservan `_id` y slugs.
 * @param {object} curso Documento Course
 * @param {object[]} modulos
 * @returns {Promise<{modulos:number, lecciones:number, omitidas:number}>}
 */
async function importarModulos(curso, modulos = []) {
    const resumen = { modulos: 0, lecciones: 0, omitidas: 0 };
    const slugsUsados = new Set((await Lesson.find({ curso: curso._id }).select('id').lean()).map((l) => l.id));
    const ordenados = [...modulos].sort((a, b) => (a.orden || 0) - (b.orden || 0));

    for (let i = 0; i < ordenados.length; i++) {
        const m = ordenados[i];
        let modulo = m._id ? await Module.findOne({ _id: m._id, curso: curso._id }) : null;
        if (!modulo) {
            modulo = await Module.create({
                ...(m._id ? { _id: m._id } : {}),
                curso: curso._id,
                cursoId: curso.id,
                titulo: m.titulo || `Módulo ${i + 1}`,
                descripcion: m.descripcion || '',
                orden: m.orden || i + 1,
                publicado: m.publicado !== false,
                quiz: Array.isArray(m.quiz) ? m.quiz : []
            });
            resumen.modulos++;
        }

        const lecciones = [...(m.lecciones || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0));
        for (let j = 0; j < lecciones.length; j++) {
            const l = lecciones[j];
            if (l._id && (await Lesson.exists({ _id: l._id }))) {
                resumen.omitidas++;
                continue;
            }

            let slug = l.id ? String(l.id) : generarIdLeccion(curso.id);
            if (slugsUsados.has(slug)) {
                if (l.id && !l._id) {
                    // Ya importada antes por slug
                    resumen.omitidas++;
                    continue;
                }
                slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
            }
            slugsUsados.add(slug);

            const leccion = new Lesson({
                ...(l._id ? { _id: l._id } : {}),
                curso: curso._id,
                cursoId: curso.id,
                modulo: modulo._id,
                id: slug,
                titulo: l.titulo || `Lección ${j + 1}`,
                descripcion: l.descripcion || '',
                duracion: l.duracion || '15 min',
                orden: l.orden || j + 1,
                publicado: l.publicado !== false,
                vistaPrevia: Boolean(l.vistaPrevia),
                bloques: Array.isArray(l.bloques) ? l.bloques : bloquesDesdeLegado(l),
                recursos: (l.recursos || []).map((r) => ({
                    titulo: r.titulo,
                    tipo: r.tipo,
                    url: r.url,
                    asset: r.asset,
                    descripcion: r.descripcion
                }))
            });
            await leccion.save();
            resumen.lecciones++;
        }
    }

    await recalcularEstadisticas(curso);
    return resumen;
}

/**
 * Crea un curso completo (ficha + módulos + lecciones) desde el formato anidado.
 * @param {object} datos Ficha del curso con `modulos` anidados opcionales
 */
async function importarCurso(datos = {}) {
    const { modulos = [], ...ficha } = datos;
    const curso = await Course.create({ ...ficha, versionContenido: 2 });
    await importarModulos(curso, modulos);
    return Course.findById(curso._id);
}

/** Borra módulos y lecciones de un curso (los archivos los borra mediaService). */
async function eliminarContenidoDeCurso(cursoObjectId) {
    const [lecciones, modulos] = await Promise.all([
        Lesson.deleteMany({ curso: cursoObjectId }),
        Module.deleteMany({ curso: cursoObjectId })
    ]);
    return { lecciones: lecciones.deletedCount, modulos: modulos.deletedCount };
}

module.exports = {
    ContentError,
    esObjectId,
    // resolución
    resolverCurso,
    resolverModulo,
    resolverLeccion,
    obtenerModulos,
    generarIdLeccion,
    // conversión
    bloquesDesdeLegado,
    limpiarBloque,
    verificarAssets,
    // módulos
    crearModulo,
    actualizarModulo,
    eliminarModulo,
    reordenarModulos,
    // lecciones
    crearLeccion,
    actualizarLeccion,
    eliminarLeccion,
    moverLeccion,
    reordenarLecciones,
    // bloques
    agregarBloque,
    actualizarBloque,
    eliminarBloque,
    reordenarBloques,
    // lectura
    recalcularEstadisticas,
    adaptarLeccion,
    cargarCursoCompleto,
    cargarTemarios,
    cargarLeccion,
    // importación / borrado
    importarModulos,
    importarCurso,
    eliminarContenidoDeCurso
};
