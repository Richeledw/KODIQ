/**
 * @file mediaStorage.js
 * @description Almacenamiento binario de archivos en MongoDB GridFS (bucket `media`).
 *
 * Responsabilidades:
 *  - Validar el tipo real del archivo (whitelist de MIME + "magic bytes"), nunca confiar
 *    en el nombre ni en el `mimetype` que envía el cliente.
 *  - Limitar el tamaño por categoría mientras se recibe el stream (sin cargarlo en memoria).
 *  - Calcular SHA-256 del contenido para integridad / detección de duplicados.
 *  - Servir descargas parciales (HTTP Range) para que los videos se puedan adelantar.
 *
 * Este módulo solo trata con GridFS. Los metadatos de negocio viven en `MediaAsset`
 * y los gestiona `mediaService`.
 */

const crypto = require('crypto');
const path = require('path');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const mongoose = require('mongoose');

const BUCKET = 'media';
const MB = 1024 * 1024;

/** Límites configurables por variables de entorno (en MB). Por defecto: 500 MB video, 50 MB archivo/documento, 10 MB imagen. */
const LIMITES = {
    video: (Number(process.env.MEDIA_MAX_VIDEO_MB) || 500) * MB,
    imagen: (Number(process.env.MEDIA_MAX_IMAGE_MB) || 10) * MB,
    documento: (Number(process.env.MEDIA_MAX_FILE_MB) || 50) * MB,
    archivo: (Number(process.env.MEDIA_MAX_FILE_MB) || 50) * MB
};

// ── Firmas binarias ─────────────────────────────────────────────────────────
const empiezaCon = (buf, bytes, offset = 0) =>
    buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);
const ascii = (s) => Array.from(Buffer.from(s, 'ascii'));

const FIRMAS = {
    mp4: (b) => empiezaCon(b, ascii('ftyp'), 4),
    webm: (b) => empiezaCon(b, [0x1a, 0x45, 0xdf, 0xa3]),
    ogg: (b) => empiezaCon(b, ascii('OggS')),
    mp3: (b) => empiezaCon(b, ascii('ID3')) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
    wav: (b) => empiezaCon(b, ascii('RIFF')) && empiezaCon(b, ascii('WAVE'), 8),
    png: (b) => empiezaCon(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    jpg: (b) => empiezaCon(b, [0xff, 0xd8, 0xff]),
    gif: (b) => empiezaCon(b, ascii('GIF8')),
    webp: (b) => empiezaCon(b, ascii('RIFF')) && empiezaCon(b, ascii('WEBP'), 8),
    pdf: (b) => empiezaCon(b, ascii('%PDF')),
    zip: (b) => empiezaCon(b, [0x50, 0x4b, 0x03, 0x04]),
    // Texto: no tiene firma; se exige que no haya bytes NUL (descarta binarios disfrazados).
    texto: (b) => !b.includes(0x00)
};

/**
 * Whitelist de tipos admitidos: MIME -> categoría, extensión guardada y firma esperada.
 * SVG y HTML se excluyen a propósito (pueden ejecutar scripts en el dominio).
 */
const TIPOS_PERMITIDOS = {
    'video/mp4': { categoria: 'video', ext: '.mp4', firma: 'mp4' },
    'video/webm': { categoria: 'video', ext: '.webm', firma: 'webm' },
    'video/ogg': { categoria: 'video', ext: '.ogv', firma: 'ogg' },
    'video/quicktime': { categoria: 'video', ext: '.mov', firma: 'mp4' },
    'audio/mpeg': { categoria: 'archivo', ext: '.mp3', firma: 'mp3' },
    'audio/ogg': { categoria: 'archivo', ext: '.ogg', firma: 'ogg' },
    'audio/wav': { categoria: 'archivo', ext: '.wav', firma: 'wav' },
    'image/png': { categoria: 'imagen', ext: '.png', firma: 'png' },
    'image/jpeg': { categoria: 'imagen', ext: '.jpg', firma: 'jpg' },
    'image/gif': { categoria: 'imagen', ext: '.gif', firma: 'gif' },
    'image/webp': { categoria: 'imagen', ext: '.webp', firma: 'webp' },
    'application/pdf': { categoria: 'documento', ext: '.pdf', firma: 'pdf' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        categoria: 'documento',
        ext: '.docx',
        firma: 'zip'
    },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
        categoria: 'documento',
        ext: '.pptx',
        firma: 'zip'
    },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        categoria: 'documento',
        ext: '.xlsx',
        firma: 'zip'
    },
    'text/plain': { categoria: 'documento', ext: '.txt', firma: 'texto' },
    'text/markdown': { categoria: 'documento', ext: '.md', firma: 'texto' },
    'text/csv': { categoria: 'documento', ext: '.csv', firma: 'texto' },
    'text/vtt': { categoria: 'documento', ext: '.vtt', firma: 'texto' },
    'application/x-subrip': { categoria: 'documento', ext: '.srt', firma: 'texto' },
    'application/zip': { categoria: 'archivo', ext: '.zip', firma: 'zip' },
    'application/x-zip-compressed': { categoria: 'archivo', ext: '.zip', firma: 'zip' }
};

/** Error de dominio con código HTTP sugerido. */
class MediaError extends Error {
    constructor(mensaje, status = 400) {
        super(mensaje);
        this.name = 'MediaError';
        this.status = status;
    }
}

function getBucket() {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) throw new MediaError('La base de datos no está conectada', 503);
    return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
}

function tipoPermitido(mimeType) {
    return Object.prototype.hasOwnProperty.call(TIPOS_PERMITIDOS, mimeType) ? TIPOS_PERMITIDOS[mimeType] : null;
}

/** Límite máximo absoluto (lo usa Multer como tope global). */
function limiteMaximo() {
    return Math.max(...Object.values(LIMITES));
}

/** Nombre de archivo seguro para guardar en GridFS (sin rutas ni caracteres raros). */
function nombreSeguro(nombreOriginal, ext) {
    const base = path
        .basename(String(nombreOriginal || 'archivo'), path.extname(String(nombreOriginal || '')))
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 100);
    return `${base || 'archivo'}${ext}`;
}

/**
 * Transform que valida la firma con los primeros bytes, controla el tamaño
 * acumulado y calcula SHA-256, todo sin bufferizar el archivo completo.
 */
function crearValidador({ firma, limite }) {
    const hash = crypto.createHash('sha256');
    let cabecera = Buffer.alloc(0);
    let validado = false;
    let bytes = 0;

    const comprobarCabecera = () => {
        if (!FIRMAS[firma](cabecera)) {
            throw new MediaError('El contenido del archivo no coincide con su tipo declarado.', 415);
        }
        validado = true;
    };

    const t = new Transform({
        transform(chunk, _enc, cb) {
            try {
                bytes += chunk.length;
                if (bytes > limite) {
                    throw new MediaError(`El archivo supera el máximo permitido de ${Math.round(limite / MB)} MB.`, 413);
                }
                hash.update(chunk);
                if (!validado) {
                    cabecera = Buffer.concat([cabecera, chunk]);
                    if (cabecera.length >= 16) comprobarCabecera();
                    else return cb();
                    const pendiente = cabecera;
                    cabecera = Buffer.alloc(0);
                    return cb(null, pendiente);
                }
                cb(null, chunk);
            } catch (err) {
                cb(err);
            }
        },
        flush(cb) {
            try {
                if (bytes === 0) throw new MediaError('El archivo está vacío.', 400);
                if (!validado) {
                    comprobarCabecera();
                    this.push(cabecera);
                }
                cb();
            } catch (err) {
                cb(err);
            }
        }
    });

    t.resultado = () => ({ bytes, sha256: hash.digest('hex') });
    return t;
}

/** Borra los restos de una subida fallida (archivo y chunks) sin lanzar errores. */
async function limpiarSubida(id) {
    try {
        const db = mongoose.connection.db;
        await Promise.all([
            db.collection(`${BUCKET}.chunks`).deleteMany({ files_id: id }),
            db.collection(`${BUCKET}.files`).deleteOne({ _id: id })
        ]);
    } catch (_e) {
        /* sin conexión o ya eliminado */
    }
}

/**
 * Guarda un stream en GridFS validando tipo y tamaño.
 * @param {import('stream').Readable} stream
 * @param {{nombreOriginal:string, mimeType:string, metadata?:object}} opciones
 * @returns {Promise<{gridFsId:import('mongoose').Types.ObjectId, tamano:number, sha256:string,
 *   categoria:string, extension:string, mimeType:string, nombreArchivo:string}>}
 */
async function guardarDesdeStream(stream, { nombreOriginal, mimeType, metadata = {} }) {
    const tipo = tipoPermitido(mimeType);
    if (!tipo) {
        stream.resume();
        throw new MediaError('Tipo de archivo no permitido.', 415);
    }

    const bucket = getBucket();
    const nombreArchivo = nombreSeguro(nombreOriginal, tipo.ext);
    const subida = bucket.openUploadStream(nombreArchivo, {
        metadata: { ...metadata, mimeType, categoria: tipo.categoria }
    });
    const validador = crearValidador({ firma: tipo.firma, limite: LIMITES[tipo.categoria] });

    try {
        await pipeline(stream, validador, subida);
    } catch (err) {
        await limpiarSubida(subida.id);
        throw err;
    }

    const { bytes, sha256 } = validador.resultado();
    return {
        gridFsId: subida.id,
        tamano: bytes,
        sha256,
        categoria: tipo.categoria,
        extension: tipo.ext,
        mimeType,
        nombreArchivo
    };
}

/** Atajo para guardar un Buffer (scripts, seeds y tests). */
async function guardarDesdeBuffer(buffer, opciones) {
    const { Readable } = require('stream');
    return guardarDesdeStream(Readable.from([buffer]), opciones);
}

/** Elimina un archivo de GridFS. No falla si ya no existe. */
async function eliminarArchivo(gridFsId) {
    if (!gridFsId) return;
    try {
        await getBucket().delete(new mongoose.Types.ObjectId(String(gridFsId)));
    } catch (err) {
        if (!/not found|FileNotFound/i.test(err.message)) throw err;
    }
}

/** Información del archivo en `media.files` o null. */
async function obtenerInfo(gridFsId) {
    const [info] = await getBucket()
        .find({ _id: new mongoose.Types.ObjectId(String(gridFsId)) })
        .limit(1)
        .toArray();
    return info || null;
}

/**
 * Interpreta la cabecera HTTP Range (solo un rango, `bytes=inicio-fin`).
 * @returns {{start:number,end:number}|null|false} null = sin rango, false = rango inválido.
 */
function parsearRango(cabecera, tamano) {
    if (!cabecera) return null;
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(cabecera).trim());
    if (!m || (m[1] === '' && m[2] === '')) return false;

    let start;
    let end;
    if (m[1] === '') {
        // Sufijo: últimos N bytes
        const n = parseInt(m[2], 10);
        start = Math.max(0, tamano - n);
        end = tamano - 1;
    } else {
        start = parseInt(m[1], 10);
        end = m[2] === '' ? tamano - 1 : Math.min(parseInt(m[2], 10), tamano - 1);
    }
    if (start > end || start >= tamano) return false;
    return { start, end };
}

/**
 * Abre un stream de lectura, opcionalmente parcial.
 * @param {string} gridFsId
 * @param {{start:number,end:number}} [rango] `end` inclusivo
 */
function abrirDescarga(gridFsId, rango) {
    const opciones = rango ? { start: rango.start, end: rango.end + 1 } : undefined;
    return getBucket().openDownloadStream(new mongoose.Types.ObjectId(String(gridFsId)), opciones);
}

module.exports = {
    BUCKET,
    LIMITES,
    TIPOS_PERMITIDOS,
    FIRMAS,
    MediaError,
    getBucket,
    tipoPermitido,
    limiteMaximo,
    nombreSeguro,
    guardarDesdeStream,
    guardarDesdeBuffer,
    eliminarArchivo,
    obtenerInfo,
    parsearRango,
    abrirDescarga
};
