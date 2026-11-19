/**
 * @file Module.js
 * @description Módulo de un curso. Vive en su propia colección (antes era un array
 * embebido dentro de `Course`) para que un curso pueda tener tantos módulos y lecciones
 * como necesite sin acercarse al límite de 16 MB por documento de MongoDB.
 */

const mongoose = require('mongoose');

const QuizQuestionSchema = new mongoose.Schema({
    pregunta: {
        type: String,
        required: true,
        maxlength: 2000
    },
    opciones: {
        type: [{ type: String, required: true, maxlength: 1000 }],
        validate: {
            validator: (arr) => Array.isArray(arr) && arr.length >= 2 && arr.length <= 10,
            message: 'Una pregunta debe tener entre 2 y 10 opciones.'
        }
    },
    respuestaCorrecta: {
        type: Number,
        required: true,
        min: 0
    },
    explicacion: {
        type: String,
        default: '',
        maxlength: 2000
    }
});

const ModuleSchema = new mongoose.Schema(
    {
        curso: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true
        },
        // Slug del curso, desnormalizado para consultas rápidas por `curso.id`.
        cursoId: {
            type: String,
            required: true,
            index: true
        },
        titulo: {
            type: String,
            required: [true, 'El título del módulo es obligatorio'],
            trim: true,
            maxlength: 200
        },
        descripcion: {
            type: String,
            default: '',
            maxlength: 5000
        },
        orden: {
            type: Number,
            default: 1
        },
        publicado: {
            type: Boolean,
            default: true
        },
        quiz: [QuizQuestionSchema]
    },
    { timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' } }
);

ModuleSchema.index({ curso: 1, orden: 1 });

module.exports = mongoose.model('Module', ModuleSchema);
module.exports.QuizQuestionSchema = QuizQuestionSchema;
