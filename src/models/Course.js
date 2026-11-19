/**
 * @file Course.js
 * @description Modelo de Mongoose para cursos en la plataforma EduPlat.
 *
 * Desde la v2 del esquema de contenido, los módulos y lecciones NO se guardan
 * embebidos en el curso, sino en sus propias colecciones:
 *
 *   Course 1 ── N Module 1 ── N Lesson ── N bloques (texto, video, código, archivo...)
 *                                  └── referencias a MediaAsset (archivos en GridFS)
 *
 * El curso conserva solo la ficha, la consigna del proyecto, los recursos globales y
 * unas estadísticas desnormalizadas (`estadisticas`) para el catálogo.
 * Usa `contentService.cargarCursoCompleto()` para obtener el curso con su temario.
 */

const mongoose = require('mongoose');
const { ResourceSchema } = require('./schemas/Resource');

const CourseSchema = new mongoose.Schema({
    id: {
        type: String,
        required: [true, 'El ID o slug del curso es obligatorio'],
        unique: true,
        trim: true,
        lowercase: true
    },
    titulo: {
        type: String,
        required: [true, 'El título del curso es obligatorio'],
        trim: true
    },
    descripcion: {
        type: String,
        required: [true, 'La descripción corta es obligatoria']
    },
    descripcionLarga: {
        type: String,
        default: ''
    },
    icono: {
        type: String,
        default: '/img/html5.svg'
    },
    categoria: {
        type: String,
        enum: ['web', 'backend', 'datos', 'diseno', 'mobile', 'devops'],
        default: 'web'
    },
    nivel: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced', 'Principiante', 'Intermedio', 'Avanzado'],
        default: 'Beginner'
    },
    duracion: {
        type: String,
        default: '10 horas'
    },
    calificacion: {
        type: Number,
        default: 4.8
    },
    resenas: {
        type: Number,
        default: 0
    },
    color: {
        type: String,
        default: 'primary'
    },
    autor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    autorNombre: {
        type: String,
        default: 'Profesor EduPlat'
    },
    publicado: {
        type: Boolean,
        default: true
    },
    // Consigna o especificación del proyecto práctico del curso
    proyectoConsigna: {
        titulo: {
            type: String,
            default: 'Proyecto Final Práctico'
        },
        descripcion: {
            type: String,
            default: 'Construye un proyecto completo aplicando todos los conceptos del curso.'
        },
        requisitos: [
            {
                type: String
            }
        ],
        recursosApoyo: [
            {
                type: String
            }
        ]
    },
    // Recursos globales adicionales del curso
    recursosGlobales: [ResourceSchema],
    // Portada opcional subida a GridFS
    portada: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MediaAsset'
    },
    // Contadores desnormalizados; los mantiene contentService.recalcularEstadisticas()
    estadisticas: {
        modulos: { type: Number, default: 0 },
        lecciones: { type: Number, default: 0 },
        minutos: { type: Number, default: 0 },
        archivos: { type: Number, default: 0 }
    },
    // Versión del esquema de contenido (2 = módulos/lecciones en colecciones propias)
    versionContenido: {
        type: Number,
        default: 2
    },
    creadoEn: {
        type: Date,
        default: Date.now
    }
});

CourseSchema.index({ publicado: 1, creadoEn: -1 });
CourseSchema.index({ categoria: 1, publicado: 1 });
CourseSchema.index({ autor: 1 });

// Total de lecciones (lectura rápida desde las estadísticas desnormalizadas)
CourseSchema.virtual('totalLecciones').get(function () {
    return (this.estadisticas && this.estadisticas.lecciones) || 0;
});

// Compatibilidad transparente: si algún llamador pasa `modulos` al crear un Course
// (ej. Course.create({ ..., modulos: [...] })), no se guarda embebido en el documento
// del curso, sino que se importa automáticamente a las colecciones Module y Lesson.
CourseSchema.virtual('modulos')
    .get(function () {
        return (this.$locals && (this.$locals.modulosCargados || this.$locals.modulosPendientes)) || [];
    })
    .set(function (valor) {
        this.$locals = this.$locals || {};
        this.$locals.modulosPendientes = Array.isArray(valor) ? valor : [];
    });

CourseSchema.post('save', async function (doc) {
    const pendientes = this.$locals && this.$locals.modulosPendientes;
    if (Array.isArray(pendientes) && pendientes.length > 0) {
        this.$locals.modulosPendientes = null;
        const contentService = require('../services/contentService');
        await contentService.importarModulos(doc, pendientes);
    }
});

module.exports = mongoose.model('Course', CourseSchema);
