/**
 * @file Enrollment.js
 * @description Modelo de Mongoose para gestionar las matrículas e inscripciones de estudiantes en cursos,
 * incluyendo progreso detallado por lección, minuto exacto de reproducción de videos y resultados de quizzes
 * (tanto a nivel de módulo como quizzes intercalados dentro de una lección).
 */

const mongoose = require('mongoose');

const VideoProgressSchema = new mongoose.Schema(
    {
        leccionId: {
            type: String,
            required: true
        },
        // Opcional: identifica un bloque de video específico cuando una lección tiene varios videos
        bloqueId: {
            type: String,
            default: 'principal'
        },
        segundoActual: {
            type: Number,
            default: 0,
            min: 0
        },
        duracionSeg: {
            type: Number,
            default: 0,
            min: 0
        },
        completado: {
            type: Boolean,
            default: false
        },
        actualizadoEn: {
            type: Date,
            default: Date.now
        }
    },
    { _id: false }
);

const QuizProgressSchema = new mongoose.Schema(
    {
        // Quiz de fin de módulo (`moduloId`) o quiz intercalado en una lección (`leccionId` + `bloqueId`)
        moduloId: {
            type: String,
            default: ''
        },
        leccionId: {
            type: String,
            default: ''
        },
        bloqueId: {
            type: String,
            default: ''
        },
        puntaje: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        mejorPuntaje: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        aprobado: {
            type: Boolean,
            default: false
        },
        intentos: {
            type: Number,
            default: 1,
            min: 1
        },
        respuestas: [
            {
                type: Number
            }
        ],
        fechaUltimoIntento: {
            type: Date,
            default: Date.now
        }
    },
    { _id: false }
);

const EnrollmentSchema = new mongoose.Schema({
    estudiante: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'El estudiante es obligatorio']
    },
    curso: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    },
    cursoId: {
        type: String,
        required: [true, 'El identificador del curso es obligatorio']
    },
    fechaInscripcion: {
        type: Date,
        default: Date.now
    },
    leccionesCompletadas: [
        {
            type: String
        }
    ],
    ultimaLeccionId: {
        type: String,
        default: ''
    },
    progresoVideos: {
        type: [VideoProgressSchema],
        default: []
    },
    progresoQuizzes: {
        type: [QuizProgressSchema],
        default: []
    },
    progreso: {
        type: Number,
        default: 0
    },
    ultimoAcceso: {
        type: Date,
        default: Date.now
    }
});

// Índice compuesto para evitar inscripciones duplicadas
EnrollmentSchema.index({ estudiante: 1, cursoId: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', EnrollmentSchema);
