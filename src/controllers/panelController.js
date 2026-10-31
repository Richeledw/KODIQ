/**
 * @file panelController.js
 * @description Controlador para gestionar las vistas del panel de control del estudiante (Dashboard),
 * progreso académico en tiempo real y proyectos prácticos entregados.
 */

const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const StudentProject = require('../models/StudentProject');
const staticCursos = require('../models/cursosData');
const path = require('path');
const fs = require('fs');

/**
 * @route GET /panel
 * @description Renderiza el panel de control del estudiante con sus cursos inscritos,
 * avance porcentual real y estado de sus proyectos prácticos.
 */
exports.getPanel = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const allDbCourses = await Course.find();

        // Mapear cursos en un diccionario rápido por ID
        const cursosDict = {};
        allDbCourses.forEach(c => {
            cursosDict[c.id] = c.toObject();
        });

        // Combinar con estáticos si alguno no está en BD
        Object.keys(staticCursos).forEach(id => {
            if (!cursosDict[id]) {
                cursosDict[id] = { id, ...staticCursos[id] };
            }
        });

        // Mapear cursos inscritos del estudiante
        const cursosInscritos = (user.cursosInscritos || []).map(ci => {
            const infoCurso = cursosDict[ci.cursoId] || {
                id: ci.cursoId,
                titulo: ci.cursoId.toUpperCase(),
                descripcion: 'Curso de la plataforma',
                icono: '/img/html5.svg',
                duracion: '10 horas'
            };

            return {
                ...infoCurso,
                progreso: ci.progreso || 0,
                leccionesCompletadasCount: (ci.leccionesCompletadas || []).length,
                fechaInscripcion: ci.fechaInscripcion
            };
        });

        // Obtener proyectos prácticos de este estudiante
        const misProyectos = await StudentProject.find({ estudiante: user._id }).sort({ actualizadoEn: -1 });

        // Progreso promedio y métricas reales
        const progresoPromedio = cursosInscritos.length > 0
            ? Math.round(cursosInscritos.reduce((acc, c) => acc + (c.progreso || 0), 0) / cursosInscritos.length)
            : 0;

        const proyectosCompletados = misProyectos.filter(p => p.estado === 'Completado').length;
        const leccionesTotalesCompletadas = cursosInscritos.reduce((acc, c) => acc + (c.leccionesCompletadasCount || 0), 0);

        res.render('panel', {
            titlePage: 'Mi Panel de Aprendizaje',
            user,
            cursosInscritos,
            misProyectos,
            totalCursos: cursosInscritos.length,
            progresoPromedio,
            proyectosCompletados,
            leccionesTotalesCompletadas
        });

    } catch (err) {
        console.error('Error al cargar panel de estudiante:', err);
        res.status(500).send('Error interno del servidor al procesar el panel');
    }
};

/**
 * @route GET /configuracion
 * @description Renderiza la vista de configuración del perfil del usuario autenticado.
 */
exports.getConfiguracion = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.render('configuracion', {
            titlePage: 'Configuración',
            user
        });
    } catch (err) {
        console.error('Error al cargar configuración del usuario:', err);
        res.status(500).send('Error interno del servidor al procesar la configuración');
    }
};

/**
 * @route POST /configuracion/perfil
 * @description Actualiza los datos del perfil del usuario (nombre, email, teléfono, ciudad, biografía).
 */
exports.postActualizarPerfil = async (req, res) => {
    try {
        // SEGURIDAD: normalizamos y forzamos string en todos los campos editables.
        const nombre = String(req.body.nombre || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const telefono = String(req.body.telefono || '').trim();
        const ciudad = String(req.body.ciudad || '').trim();
        const bio = String(req.body.bio || '').trim();
        const user = await User.findById(req.user.id);

        if (!user) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/configuracion');
        }

        if (!nombre) {
            req.flash('error_msg', 'El nombre es obligatorio.');
            return res.redirect('/configuracion');
        }

        if (email && email !== user.email) {
            const emailExiste = await User.findOne({ email, _id: { $ne: user._id } })
                .collation({ locale: 'en', strength: 2 });
            if (emailExiste) {
                req.flash('error_msg', 'Ese correo electrónico ya está registrado por otra cuenta.');
                return res.redirect('/configuracion');
            }
            user.email = email;
        }

        user.nombre = nombre;
        user.telefono = telefono;
        user.ciudad = ciudad;
        user.bio = bio;

        await user.save();

        // Actualizar sesión si existe
        if (req.session && req.session.user) {
            req.session.user.nombre = user.nombre;
            req.session.user.email = user.email;
        }

        req.flash('success_msg', 'Perfil actualizado correctamente.');
        res.redirect('/configuracion');
    } catch (err) {
        console.error('Error al actualizar perfil:', err);
        req.flash('error_msg', 'Ocurrió un error al actualizar el perfil.');
        res.redirect('/configuracion');
    }
};

/**
 * @route POST /configuracion/password
 * @description Modifica la contraseña del usuario tras verificar la contraseña actual.
 */
exports.postCambiarPassword = async (req, res) => {
    try {
        // SEGURIDAD: forzamos string y exigimos mínimo 8 caracteres en contraseñas nuevas.
        const passwordActual = String(req.body.passwordActual || '');
        const passwordNueva = String(req.body.passwordNueva || '');
        const passwordConfirmar = String(req.body.passwordConfirmar || '');

        if (!passwordActual || !passwordNueva || !passwordConfirmar) {
            req.flash('error_msg', 'Por favor completa todos los campos de contraseña.');
            return res.redirect('/configuracion');
        }

        if (passwordNueva.length < 8) {
            req.flash('error_msg', 'La nueva contraseña debe tener al menos 8 caracteres.');
            return res.redirect('/configuracion');
        }

        if (passwordNueva !== passwordConfirmar) {
            req.flash('error_msg', 'Las nuevas contraseñas no coinciden.');
            return res.redirect('/configuracion');
        }

        const user = await User.findById(req.user.id).select('+password');
        if (!user) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/configuracion');
        }

        const esCorrecta = await user.matchPassword(passwordActual);
        if (!esCorrecta) {
            req.flash('error_msg', 'La contraseña actual ingresada es incorrecta.');
            return res.redirect('/configuracion');
        }

        user.password = passwordNueva;
        await user.save();

        req.flash('success_msg', 'Contraseña actualizada con éxito.');
        res.redirect('/configuracion');
    } catch (err) {
        console.error('Error al cambiar contraseña:', err);
        req.flash('error_msg', 'Ocurrió un error al intentar cambiar la contraseña.');
        res.redirect('/configuracion');
    }
};

/**
 * @route POST /configuracion/eliminar-cuenta
 * @description Elimina permanentemente la cuenta del usuario autenticado y destruye la sesión.
 */
exports.postEliminarCuenta = async (req, res) => {
    try {
        const userId = req.user.id;
        await User.findByIdAndDelete(userId);

        if (typeof req.logout === 'function') {
            req.logout(function (err) {
                if (req.session) {
                    req.session.destroy(() => {
                        res.redirect('/?cuentaEliminada=true');
                    });
                } else {
                    res.redirect('/?cuentaEliminada=true');
                }
            });
        } else {
            if (req.session) {
                req.session.destroy(() => {
                    res.redirect('/?cuentaEliminada=true');
                });
            } else {
                res.redirect('/?cuentaEliminada=true');
            }
        }
    } catch (err) {
        console.error('Error al eliminar cuenta:', err);
        req.flash('error_msg', 'No se pudo eliminar la cuenta en este momento.');
        res.redirect('/configuracion');
    }
};

/**
 * @route POST /configuracion/avatar
 * @description Sube y actualiza la foto de perfil del usuario autenticado.
 */
exports.postActualizarAvatar = async (req, res) => {
    try {
        if (!req.file) {
            req.flash('error_msg', 'Por favor selecciona una imagen para subir.');
            return res.redirect('/configuracion');
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/configuracion');
        }

        // Si tenía un avatar previo subido, eliminarlo del disco para no acumular archivos huérfanos
        if (user.avatar && user.avatar.startsWith('/uploads/avatars/')) {
            const oldPath = path.join(__dirname, '../../public', user.avatar);
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch (e) { console.error('Error al borrar avatar viejo:', e); }
            }
        }

        user.avatar = `/uploads/avatars/${req.file.filename}`;
        await user.save();

        if (req.session && req.session.user) {
            req.session.user.avatar = user.avatar;
        }

        req.flash('success_msg', 'Foto de perfil actualizada exitosamente.');
        res.redirect('/configuracion');

    } catch (err) {
        console.error('Error al actualizar avatar:', err);
        req.flash('error_msg', 'Error al procesar la subida del avatar.');
        res.redirect('/configuracion');
    }
};
