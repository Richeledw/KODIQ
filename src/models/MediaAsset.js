/**
 * @file MediaAsset.js
 * @description Metadatos de los archivos subidos a la plataforma (videos, imágenes,
 * documentos y adjuntos). El contenido binario vive en MongoDB GridFS (bucket `media`);
 * este documento guarda quién lo subió, a qué curso pertenece y cómo debe servirse.
 *
 * Decisión de diseño:
 *  - Separar metadatos (colección `mediaassets`) de los bytes (`media.files` / `media.chunks`)
 *    permite consultar, filtrar y auditar archivos sin tocar GridFS.
 *  - `gridFsId` es el `_id` del archivo en `media.files`. Se borra en cascada desde el servicio.
 */

const mongoose = require('mongoose');

const CATEGORIAS = ['video', 'imagen', 'documento', 'archivo'];

const MediaAssetSchema = new mongoose.Schema(
    {
        gridFsId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            unique: true
        },
        bucket: {
            type: String,
            default: 'media'
        },
        nombreOriginal: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255
        },
        mimeType: {
            type: String,
            required: true
        },
        extension: {
            type: String,
            default: ''
        },
        categoria: {
            type: String,
            enum: CATEGORIAS,
            required: true
        },
        tamano: {
            type: Number,
            required: true,
            min: 0
        },
        // Huella SHA-256 del contenido: sirve para detectar duplicados y verificar integridad.
        sha256: {
            type: String,
            default: ''
        },
        curso: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            index: true
        },
        cursoId: {
            type: String,
            index: true
        },
        subidoPor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        // Recursos públicos (ej. portada del curso) no exigen inscripción para verse.
        publico: {
            type: Boolean,
            default: false
        },
        // Metadatos opcionales que el docente puede completar (duración de un video, texto alternativo...)
        duracionSeg: {
            type: Number,
            default: 0,
            min: 0
        },
        descripcion: {
            type: String,
            default: '',
            maxlength: 1000
        }
    },
    { timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' } }
);

MediaAssetSchema.index({ curso: 1, categoria: 1, creadoEn: -1 });

/** URL interna desde la que se sirve el archivo (con control de acceso y soporte de Range). */
MediaAssetSchema.virtual('url').get(function () {
    return `/media/${this._id}`;
});

MediaAssetSchema.set('toJSON', { virtuals: true });
MediaAssetSchema.set('toObject', { virtuals: true });

MediaAssetSchema.statics.CATEGORIAS = CATEGORIAS;

module.exports = mongoose.model('MediaAsset', MediaAssetSchema);
