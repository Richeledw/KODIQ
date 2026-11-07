/**
 * @file messageController.js
 * @description Gestión de mensajes de soporte y contacto para Administradores.
 */

const ContactMessage = require('../../models/ContactMessage');
const logger = require('../../utils/logger');

exports.getMensajes = async (req, res) => {
    try {
        const mensajes = await ContactMessage.find().sort({ creadoEn: -1 });
        const totalMensajes = mensajes.length;
        const mensajesNuevos = mensajes.filter((m) => !m.leido).length;

        res.render('admin/mensajes', {
            titlePage: 'Mensajes de Soporte y Contacto',
            mensajes,
            totalMensajes,
            mensajesNuevos
        });
    } catch (err) {
        logger.error({ err }, 'Error al listar mensajes de contacto');
        res.status(500).render('error', {
            mensaje: 'Error interno del servidor',
            descripcion: 'No se pudieron cargar los mensajes de soporte.',
            status: 500
        });
    }
};

exports.postMarcarLeidoMensaje = async (req, res) => {
    try {
        const { id } = req.params;
        const mensaje = await ContactMessage.findById(id);
        if (mensaje) {
            mensaje.leido = !mensaje.leido;
            await mensaje.save();
            req.flash('success_msg', mensaje.leido ? 'Mensaje marcado como leído.' : 'Mensaje marcado como no leído.');
        }
        res.redirect('/admin/mensajes');
    } catch (err) {
        logger.error({ err }, 'Error al actualizar estado del mensaje');
        req.flash('error_msg', 'No se pudo actualizar el estado del mensaje.');
        res.redirect('/admin/mensajes');
    }
};

exports.postEliminarMensaje = async (req, res) => {
    try {
        const { id } = req.params;
        await ContactMessage.findByIdAndDelete(id);
        req.flash('success_msg', 'Mensaje eliminado correctamente.');
        res.redirect('/admin/mensajes');
    } catch (err) {
        logger.error({ err }, 'Error al eliminar mensaje de contacto');
        req.flash('error_msg', 'No se pudo eliminar el mensaje.');
        res.redirect('/admin/mensajes');
    }
};
