/**
 * @file userController.js
 * @description Gestión de usuarios y métricas del panel de administración.
 */

const mongoose = require('mongoose');
const User = require('../../models/User');
const Course = require('../../models/Course');
const StudentProject = require('../../models/StudentProject');
const Enrollment = require('../../models/Enrollment');
const logger = require('../../utils/logger');

/**
 * Indica si el usuario indicado es el único administrador activo.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function esUltimoAdminActivo(userId) {
    const otrosAdmins = await User.countDocuments({
        rol: 'admin',
        activo: true,
        _id: { $ne: userId }
    });
    return otrosAdmins === 0;
}

exports.getDashboard = async (req, res) => {
    try {
        const [totalEstudiantes, totalDocentes, totalAdmins, totalCursos, totalProyectos] = await Promise.all([
            User.countDocuments({ rol: 'estudiante' }),
            User.countDocuments({ rol: 'docente' }),
            User.countDocuments({ rol: 'admin' }),
            Course.countDocuments(),
            StudentProject.countDocuments()
        ]);

        const ultimosUsuarios = await User.find()
            .sort({ creadoEn: -1 })
            .limit(8)
            .select('nombre email rol activo creadoEn');

        const ultimosCursos = await Course.find().sort({ creadoEn: -1 }).limit(6);

        res.render('admin/dashboard', {
            titlePage: 'Panel de Administrador',
            totalEstudiantes,
            totalDocentes,
            totalAdmins,
            totalCursos,
            totalProyectos,
            ultimosUsuarios,
            ultimosCursos
        });
    } catch (err) {
        logger.error({ err }, 'Error en dashboard de admin');
        res.status(500).render('error', {
            mensaje: 'Error interno del servidor',
            descripcion: 'No se pudo cargar el panel administrativo.',
            status: 500
        });
    }
};

exports.getUsuarios = async (req, res) => {
    try {
        const usuarios = await User.find().sort({ creadoEn: -1 }).select('nombre email rol activo creadoEn');
        res.render('admin/usuarios', {
            titlePage: 'Gestión de Usuarios',
            usuarios
        });
    } catch (err) {
        logger.error({ err }, 'Error al obtener usuarios en admin');
        res.status(500).render('error', {
            mensaje: 'Error interno del servidor',
            descripcion: 'No se pudo obtener el listado de usuarios.',
            status: 500
        });
    }
};

exports.cambiarRol = async (req, res) => {
    try {
        const { id } = req.params;
        const rol = String(req.body.rol || '');
        const rolesValidos = ['estudiante', 'docente', 'admin'];

        if (!mongoose.Types.ObjectId.isValid(id)) {
            req.flash('error_msg', 'El identificador de usuario no es válido.');
            return res.redirect('/admin/usuarios');
        }

        if (!rolesValidos.includes(rol)) {
            req.flash('error_msg', 'Rol especificado no válido');
            return res.redirect('/admin/usuarios');
        }

        const usuario = await User.findById(id);
        if (!usuario) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/admin/usuarios');
        }

        if (req.user._id.toString() === id && rol !== 'admin') {
            req.flash('error_msg', 'No puedes quitarte tu propio rol de administrador.');
            return res.redirect('/admin/usuarios');
        }

        if (usuario.rol === 'admin' && rol !== 'admin' && usuario.activo && (await esUltimoAdminActivo(id))) {
            req.flash('error_msg', 'No puedes degradar al último administrador activo.');
            return res.redirect('/admin/usuarios');
        }

        usuario.rol = rol;
        await usuario.save();

        req.flash('success_msg', 'Rol de usuario actualizado correctamente.');
        res.redirect('/admin/usuarios');
    } catch (err) {
        logger.error({ err }, 'Error al cambiar rol');
        req.flash('error_msg', 'Error al cambiar el rol.');
        res.redirect('/admin/usuarios');
    }
};

exports.editarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const nombre = String(req.body.nombre || '').trim();
        const email = String(req.body.email || '')
            .trim()
            .toLowerCase();
        const rol = String(req.body.rol || 'estudiante');

        if (!mongoose.Types.ObjectId.isValid(id)) {
            req.flash('error_msg', 'El identificador de usuario no es válido.');
            return res.redirect('/admin/usuarios');
        }

        if (!['estudiante', 'docente', 'admin'].includes(rol)) {
            req.flash('error_msg', 'Rol especificado no válido.');
            return res.redirect('/admin/usuarios');
        }

        const usuario = await User.findById(id);
        if (!usuario) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/admin/usuarios');
        }

        if (req.user._id.toString() === id && rol !== 'admin') {
            req.flash('error_msg', 'No puedes quitarte tu propio rol de administrador.');
            return res.redirect('/admin/usuarios');
        }

        if (usuario.rol === 'admin' && rol !== 'admin' && usuario.activo && (await esUltimoAdminActivo(id))) {
            req.flash('error_msg', 'No puedes degradar al último administrador activo.');
            return res.redirect('/admin/usuarios');
        }

        const emailExiste = await User.findOne({ email, _id: { $ne: usuario._id } }).collation({
            locale: 'en',
            strength: 2
        });
        if (emailExiste) {
            req.flash('error_msg', 'Ese correo electrónico ya está registrado por otra cuenta.');
            return res.redirect('/admin/usuarios');
        }

        usuario.nombre = nombre;
        usuario.email = email;
        usuario.rol = rol;
        await usuario.save();

        req.flash('success_msg', 'Datos del usuario actualizados exitosamente.');
        res.redirect('/admin/usuarios');
    } catch (err) {
        logger.error({ err }, 'Error al editar usuario');
        req.flash('error_msg', 'Error al actualizar usuario.');
        res.redirect('/admin/usuarios');
    }
};

exports.toggleEstadoUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            req.flash('error_msg', 'El identificador de usuario no es válido.');
            return res.redirect('/admin/usuarios');
        }

        const usuario = await User.findById(id);
        if (!usuario) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/admin/usuarios');
        }

        if (req.user && req.user._id.toString() === id) {
            req.flash('error_msg', 'No puedes desactivar tu propia cuenta administradora.');
            return res.redirect('/admin/usuarios');
        }

        if (usuario.rol === 'admin' && usuario.activo && (await esUltimoAdminActivo(id))) {
            req.flash('error_msg', 'No puedes desactivar al último administrador activo.');
            return res.redirect('/admin/usuarios');
        }

        usuario.activo = !usuario.activo;
        await usuario.save();

        req.flash(
            'success_msg',
            `Cuenta de ${usuario.nombre} ${usuario.activo ? 'activada' : 'desactivada'} correctamente.`
        );
        res.redirect('/admin/usuarios');
    } catch (err) {
        logger.error({ err }, 'Error al alternar estado de usuario');
        req.flash('error_msg', 'Error al modificar el estado de la cuenta.');
        res.redirect('/admin/usuarios');
    }
};

exports.eliminarUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            req.flash('error_msg', 'El identificador de usuario no es válido.');
            return res.redirect('/admin/usuarios');
        }

        if (req.user && req.user._id && req.user._id.toString() === id.toString()) {
            req.flash('error_msg', 'No puedes eliminar tu propia cuenta de administrador.');
            return res.redirect('/admin/usuarios');
        }

        const usuario = await User.findById(id);
        if (!usuario) {
            req.flash('error_msg', 'El usuario no existe o ya fue eliminado previamente.');
            return res.redirect('/admin/usuarios');
        }

        if (usuario.rol === 'admin' && usuario.activo && (await esUltimoAdminActivo(id))) {
            req.flash('error_msg', 'No puedes eliminar al último administrador activo.');
            return res.redirect('/admin/usuarios');
        }

        await User.findByIdAndDelete(id);
        await Enrollment.deleteMany({ estudiante: id });
        await StudentProject.deleteMany({ estudiante: id });

        req.flash('success_msg', `Usuario "${usuario.nombre}" (${usuario.email}) eliminado correctamente.`);
        res.redirect('/admin/usuarios');
    } catch (err) {
        logger.error({ err }, 'Error al eliminar usuario');
        req.flash('error_msg', 'Error al procesar la eliminación del usuario.');
        res.redirect('/admin/usuarios');
    }
};
