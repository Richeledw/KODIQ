/**
 * @file Lesson.js
 * @description Lección de un módulo. Cada lección es un documento independiente con una
 * lista ordenada de **bloques de contenido** (texto, video, código, archivo, imagen,
 * embed y aviso), de modo que una clase puede intercalar varios videos, explicaciones
 * largas, fragmentos de código y archivos descargables.
 *
 * Decisiones de diseño:
 *  - `id` (slug) es la clave estable del progreso del estudiante (`Enrollment.leccionesCompletadas`)
 *    y es única dentro del curso. Reordenar o mover lecciones no rompe el progreso.
 *  - Los bloques usan *embedded discriminators* de Mongoose (`tipo`), así cada tipo
 *    tiene sus propios campos y validaciones.
 *  - `resumen`, `videoPrincipal`, `duracionMin` y `tiposContenido` se calculan al guardar.
 *    Permiten listar el temario sin cargar los bloques (que pueden ser muy grandes).
 *  - Los archivos binarios NO se guardan aquí: los bloques referencian `MediaAsset` (GridFS).
 */

const mongoose = require('mongoose');
const { ResourceSchema, esUrlSegura } = require('./schemas/Resource');
const { QuizQuestionSchema } = require('./Module');

const TIPOS_BLOQUE = ['texto', 'video', 'codigo', 'archivo', 'imagen', 'embed', 'aviso', 'quiz'];
const PROVEEDORES_VIDEO = ['youtube', 'vimeo', 'url', 'archivo'];

/** Límite práctico por lección (MongoDB permite 16 MB por documento). */
const MAX_BYTES_LECCION = 12 * 1024 * 1024;
const MAX_BLOQUES = 300;

const urlSegura = {
    validator: esUrlSegura,
    message: 'La URL debe empezar por http(s):// o por /.'
};

// ── Bloque base ─────────────────────────────────────────────────────────────
const BloqueSchema = new mongoose.Schema(
    {
        titulo: { type: String, default: '', trim: true, maxlength: 300 }
    },
    { discriminatorKey: 'tipo' }
);

// ── Esquema de la lección ───────────────────────────────────────────────────
const LessonSchema = new mongoose.Schema(
    {
        curso: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true
        },
        cursoId: {
            type: String,
            required: true
        },
        modulo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Module',
            required: true
        },
        id: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },
        titulo: {
            type: String,
            required: [true, 'El título de la lección es obligatorio'],
            trim: true,
            maxlength: 200
        },
        descripcion: {
            type: String,
            default: '',
            maxlength: 5000
        },
        // Texto legible ("15 min") y valor numérico para sumar duraciones del curso.
        duracion: {
            type: String,
            default: '15 min',
            maxlength: 50
        },
        duracionMin: {
            type: Number,
            default: 0,
            min: 0
        },
        orden: {
            type: Number,
            default: 1
        },
        publicado: {
            type: Boolean,
            default: true
        },
        // Lección visible sin inscripción (clase de muestra).
        vistaPrevia: {
            type: Boolean,
            default: false
        },
        bloques: {
            type: [BloqueSchema],
            validate: {
                validator: (arr) => !arr || arr.length <= MAX_BLOQUES,
                message: `Una lección no puede tener más de ${MAX_BLOQUES} bloques.`
            }
        },
        recursos: [ResourceSchema],

        // ── Campos derivados (se recalculan en pre('save')) ──
        resumen: { type: String, default: '' },
        videoPrincipal: { type: String, default: '' },
        tiposContenido: [{ type: String }]
    },
    { timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' } }
);

LessonSchema.index({ curso: 1, id: 1 }, { unique: true });
LessonSchema.index({ modulo: 1, orden: 1 });
LessonSchema.index({ 'bloques.asset': 1 }, { sparse: true });
LessonSchema.index({ 'bloques.subtitulos.asset': 1 }, { sparse: true });
LessonSchema.index({ 'recursos.asset': 1 }, { sparse: true });

// ── Subesquemas para capítulos y subtítulos de video ────────────────────────
const CapituloVideoSchema = new mongoose.Schema(
    {
        titulo: { type: String, required: true, trim: true, maxlength: 200 },
        segundoInicio: { type: Number, required: true, min: 0 },
        descripcion: { type: String, default: '', maxlength: 500 }
    },
    { _id: false }
);

const SubtituloVideoSchema = new mongoose.Schema(
    {
        idioma: { type: String, required: true, trim: true, maxlength: 15, default: 'es' },
        etiqueta: { type: String, default: 'Español', trim: true, maxlength: 60 },
        asset: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
        url: { type: String, default: '', trim: true, maxlength: 2000, validate: urlSegura }
    },
    { _id: false }
);

// ── Discriminadores de bloques ──────────────────────────────────────────────
const bloques = LessonSchema.path('bloques');

bloques.discriminator(
    'texto',
    new mongoose.Schema({
        formato: { type: String, enum: ['markdown', 'html', 'plano'], default: 'markdown' },
        contenido: { type: String, default: '', maxlength: 200000 }
    })
);

bloques.discriminator(
    'video',
    new mongoose.Schema({
        proveedor: { type: String, enum: PROVEEDORES_VIDEO, default: 'url' },
        url: { type: String, default: '', trim: true, maxlength: 2000, validate: urlSegura },
        asset: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
        duracionSeg: { type: Number, default: 0, min: 0 },
        transcripcion: { type: String, default: '', maxlength: 200000 },
        capitulos: { type: [CapituloVideoSchema], default: [] },
        subtitulos: { type: [SubtituloVideoSchema], default: [] }
    })
);

bloques.discriminator(
    'codigo',
    new mongoose.Schema({
        lenguaje: { type: String, default: 'javascript', trim: true, maxlength: 40 },
        nombreArchivo: { type: String, default: '', trim: true, maxlength: 200 },
        contenido: { type: String, default: '', maxlength: 100000 }
    })
);

bloques.discriminator(
    'archivo',
    new mongoose.Schema({
        asset: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
        url: { type: String, default: '', trim: true, maxlength: 2000, validate: urlSegura },
        descripcion: { type: String, default: '', maxlength: 2000 }
    })
);

bloques.discriminator(
    'imagen',
    new mongoose.Schema({
        asset: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
        url: { type: String, default: '', trim: true, maxlength: 2000, validate: urlSegura },
        alt: { type: String, default: '', maxlength: 500 },
        pie: { type: String, default: '', maxlength: 1000 }
    })
);

bloques.discriminator(
    'embed',
    new mongoose.Schema({
        url: { type: String, required: true, trim: true, maxlength: 2000, validate: urlSegura },
        alto: { type: Number, default: 480, min: 100, max: 2000 }
    })
);

bloques.discriminator(
    'aviso',
    new mongoose.Schema({
        variante: { type: String, enum: ['info', 'tip', 'importante', 'advertencia'], default: 'info' },
        contenido: { type: String, default: '', maxlength: 20000 }
    })
);

bloques.discriminator(
    'quiz',
    new mongoose.Schema({
        preguntas: {
            type: [QuizQuestionSchema],
            validate: {
                validator: (arr) => Array.isArray(arr) && arr.length >= 1 && arr.length <= 50,
                message: 'Un bloque de quiz debe tener entre 1 y 50 preguntas.'
            }
        },
        puntajeMinimo: { type: Number, default: 70, min: 0, max: 100 },
        explicacionGeneral: { type: String, default: '', maxlength: 5000 }
    })
);

// ── Utilidades ──────────────────────────────────────────────────────────────

/**
 * Detecta el proveedor de un video y devuelve una URL lista para embeber.
 * @param {string} url
 * @returns {{proveedor:string, url:string}}
 */
function normalizarVideo(url) {
    const raw = String(url || '').trim();
    if (!raw) return { proveedor: 'url', url: '' };

    const yt =
        raw.match(/youtu\.be\/([\w-]{6,})/) ||
        raw.match(/youtube(?:-nocookie)?\.com\/(?:embed|shorts|live)\/([\w-]{6,})/) ||
        raw.match(/youtube\.com\/watch\?(?:.*&)?v=([\w-]{6,})/);
    if (yt) return { proveedor: 'youtube', url: `https://www.youtube.com/embed/${yt[1]}` };

    const vimeo = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeo) return { proveedor: 'vimeo', url: `https://player.vimeo.com/video/${vimeo[1]}` };

    return { proveedor: 'url', url: raw };
}

/** Convierte "1h 30 min", "45 min", "90" o "2 horas" en minutos. */
function parsearDuracionMin(texto) {
    if (typeof texto === 'number') return Math.max(0, Math.round(texto));
    const t = String(texto || '').toLowerCase();
    if (!t.trim()) return 0;
    let total = 0;
    const horas = t.match(/(\d+(?:[.,]\d+)?)\s*(h|hora|horas|hr|hrs)\b/);
    const minutos = t.match(/(\d+)\s*(m|min|mins|minuto|minutos)\b/);
    if (horas) total += parseFloat(horas[1].replace(',', '.')) * 60;
    if (minutos) total += parseInt(minutos[1], 10);
    if (!horas && !minutos) {
        const n = parseFloat(t);
        if (Number.isFinite(n)) total = n;
    }
    return Math.max(0, Math.round(total));
}

/** Elimina marcas Markdown básicas para construir un resumen legible. */
function textoPlano(md) {
    return String(md || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[#>*_`~[\]()!-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ── Validación por tipo de bloque ───────────────────────────────────────────
LessonSchema.pre('validate', function () {
    (this.bloques || []).forEach((b, i) => {
        const ruta = `bloques.${i}`;
        if (!TIPOS_BLOQUE.includes(b.tipo)) {
            this.invalidate(`${ruta}.tipo`, `Tipo de bloque no válido: "${b.tipo}"`);
            return;
        }
        if (b.tipo === 'video') {
            if (b.proveedor === 'archivo' || (!b.url && b.asset)) {
                b.proveedor = 'archivo';
                if (!b.asset) this.invalidate(`${ruta}.asset`, 'El video subido es obligatorio');
            } else if (!b.url) {
                this.invalidate(`${ruta}.url`, 'La URL del video es obligatoria');
            } else {
                const norm = normalizarVideo(b.url);
                b.proveedor = norm.proveedor;
                b.url = norm.url;
            }
            if (Array.isArray(b.capitulos) && b.capitulos.length > 1) {
                b.capitulos.sort((a, c) => (a.segundoInicio || 0) - (c.segundoInicio || 0));
            }
            if (Array.isArray(b.subtitulos)) {
                b.subtitulos.forEach((s, sIdx) => {
                    if (!s.asset && !s.url) {
                        this.invalidate(
                            `${ruta}.subtitulos.${sIdx}.url`,
                            'Cada pista de subtítulos necesita un archivo subido o una URL'
                        );
                    }
                });
            }
        }
        if ((b.tipo === 'archivo' || b.tipo === 'imagen') && !b.asset && !b.url) {
            this.invalidate(`${ruta}.asset`, 'El bloque necesita un archivo subido o una URL');
        }
    });
});

// ── Campos derivados y control de tamaño ────────────────────────────────────
LessonSchema.pre('save', function () {
    const lista = this.bloques || [];

    const primerTexto = lista.find((b) => b.tipo === 'texto' && b.contenido);
    this.resumen = primerTexto ? textoPlano(primerTexto.contenido).slice(0, 300) : '';

    const primerVideo = lista.find((b) => b.tipo === 'video');
    if (primerVideo) {
        this.videoPrincipal =
            primerVideo.proveedor === 'archivo' && primerVideo.asset ? `/media/${primerVideo.asset}` : primerVideo.url;
    } else {
        this.videoPrincipal = '';
    }

    this.tiposContenido = Array.from(new Set(lista.map((b) => b.tipo)));

    // Si hay videos con duración conocida y no se indicó duración manual, se usa su suma.
    const segundosVideo = lista.reduce((acc, b) => acc + (b.tipo === 'video' ? b.duracionSeg || 0 : 0), 0);
    const manual = parsearDuracionMin(this.duracion);
    this.duracionMin = manual || Math.round(segundosVideo / 60);

    const bytes = mongoose.mongo.BSON.calculateObjectSize(this.toObject({ depopulate: true }));
    if (bytes > MAX_BYTES_LECCION) {
        throw new Error(
            `La lección supera el tamaño máximo (${Math.round(bytes / 1048576)} MB). ` +
                'Divide el contenido en varias lecciones o sube los textos largos como archivo.'
        );
    }
});

LessonSchema.statics.TIPOS_BLOQUE = TIPOS_BLOQUE;
LessonSchema.statics.PROVEEDORES_VIDEO = PROVEEDORES_VIDEO;

module.exports = mongoose.model('Lesson', LessonSchema);
module.exports.normalizarVideo = normalizarVideo;
module.exports.parsearDuracionMin = parsearDuracionMin;
module.exports.textoPlano = textoPlano;
module.exports.TIPOS_BLOQUE = TIPOS_BLOQUE;
