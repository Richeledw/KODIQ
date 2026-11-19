/**
 * @file Resource.js
 * @description Subesquema reutilizable para recursos descargables o enlaces de apoyo.
 * Un recurso puede apuntar a una URL externa (`url`) o a un archivo propio subido a
 * GridFS (`asset`). Se usa en `Course.recursosGlobales` y en `Lesson.recursos`.
 */

const mongoose = require('mongoose');

const TIPOS_RECURSO = ['pdf', 'link', 'github', 'zip', 'guia', 'archivo', 'video', 'imagen'];

/** Solo se admiten URLs http(s) o rutas internas (evita `javascript:` y `data:`). */
function esUrlSegura(valor) {
    if (!valor) return true;
    const v = String(valor).trim();
    return /^https?:\/\//i.test(v) || (v.startsWith('/') && !v.startsWith('//'));
}

const ResourceSchema = new mongoose.Schema({
    titulo: {
        type: String,
        required: [true, 'El título del recurso es obligatorio'],
        trim: true,
        maxlength: 200
    },
    tipo: {
        type: String,
        enum: TIPOS_RECURSO,
        default: 'link'
    },
    url: {
        type: String,
        default: '',
        trim: true,
        maxlength: 2000,
        validate: { validator: esUrlSegura, message: 'La URL del recurso debe empezar por http(s):// o por /.' }
    },
    asset: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MediaAsset'
    },
    descripcion: {
        type: String,
        default: '',
        maxlength: 2000
    }
});

// Un recurso necesita al menos una URL o un archivo subido.
ResourceSchema.pre('validate', function () {
    if (!this.url && !this.asset) {
        this.invalidate('url', 'La URL o el archivo del recurso es obligatorio');
    }
});

module.exports = { ResourceSchema, TIPOS_RECURSO, esUrlSegura };
