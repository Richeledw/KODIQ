/**
 * @file ownCourse.js
 * @description Middleware de autorización a nivel de recurso (anti-IDOR).
 * Garantiza que un docente solo pueda tocar los cursos que él creó.
 *
 *  - admin: acceso a cualquier curso.
 *  - docente: solo si `curso.autor` es su _id.
 *  - Cursos sin autor (p. ej. los del seed) solo los puede gestionar un admin.
 *    (Antes la validación era `curso.autor && ...`, y un curso sin autor lo editaba cualquiera.)
 */

const Course = require('../models/Course');

module.exports = async (req, res, next) => {
    try {
        const curso = await Course.findOne({ id: String(req.params.id) });

        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/docente/dashboard');
        }

        const esAdmin = req.user.rol === 'admin';
        const esAutor = !!curso.autor && curso.autor.toString() === req.user._id.toString();

        if (!esAdmin && !esAutor) {
            req.flash('error_msg', 'No tienes permiso para gestionar este curso.');
            return res.redirect(403, '/docente/dashboard');
        }

        req.curso = curso; // disponible para los controladores si lo quieren reutilizar
        next();
    } catch (err) {
        console.error('Error en ownCourse:', err);
        req.flash('error_msg', 'No se pudo verificar la propiedad del curso.');
        res.redirect('/docente/dashboard');
    }
};
