/**
 * @file ContactMessage.js
 * @description Modelo de Mongoose para almacenar los mensajes de contacto enviados por los usuarios o visitantes.
 */

const mongoose = require('mongoose');

const ContactMessageSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre es obligatorio'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'El correo electrónico es obligatorio'],
        trim: true,
        lowercase: true
    },
    asunto: {
        type: String,
        required: [true, 'El asunto es obligatorio'],
        trim: true
    },
    mensaje: {
        type: String,
        required: [true, 'El mensaje es obligatorio'],
        trim: true
    },
    leido: {
        type: Boolean,
        default: false
    },
    respondido: {
        type: Boolean,
        default: false
    },
    creadoEn: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ContactMessage', ContactMessageSchema);
