/**
 * @file authController.js
 * @description Controlador de lógica de negocio para la autenticación de usuarios
 * (registro con selección de rol, ingreso con redirección según rol, y cierre de sesión).
 */

const passport = require('passport');
const User = require('../models/User');
const sendEmail = require('../utils/email');
const crypto = require('crypto');

// SEGURIDAD: el registro público SOLO crea cuentas de estudiante.
// Los docentes los promueve un administrador (/admin/usuarios/:id/rol) y el primer
// administrador se crea por consola con: node scripts/createAdmin.js

/**
 * @route GET /registro
 * @description Muestra la vista con el formulario de creación de cuenta.
 */
exports.getRegistro = (req, res) => {
    res.render('registro', {
        datosRegistro: {
            titulo: 'Crear Cuenta',
            descripcion: 'Únete a nuestra comunidad de aprendizaje'
        }
    });
};

/**
 * @route POST /registro
 * @description Procesa el registro del usuario.
 * Valida los campos, verifica duplicidad de email, crea SIEMPRE una cuenta de
 * estudiante (los roles privilegiados se asignan fuera del registro público), guarda el usuario en la BD,
 * intenta enviar un correo de bienvenida y luego inicia sesión automáticamente.
 */
exports.postRegistro = async (req, res) => {
    // SEGURIDAD: forzamos string y normalizamos el email antes de cualquier consulta.
    const nombre = String(req.body.nombre || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    let errors = [];

    // ── Validaciones básicas ──────────────────────────────────────────────
    if (!nombre || !email || !password) {
        errors.push({ msg: 'Por favor rellena todos los campos obligatorios' });
    }

    if (password && password.length < 8) {
        errors.push({ msg: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // ── Rol: nunca se acepta del cliente en el registro público ───────────
    const rolSolicitado = 'estudiante';

    // Si existen errores de validación, re-renderizar el formulario
    if (errors.length > 0) {
        return res.render('registro', {
            errors,
            nombre,
            email,
            rolSolicitado,
            datosRegistro: { titulo: 'Crear Cuenta', descripcion: 'Únete a nuestra comunidad' }
        });
    }

    try {
        // Verificar si el correo electrónico ya está registrado (sin distinguir mayúsculas)
        let user = await User.findOne({ email }).collation({ locale: 'en', strength: 2 });
        if (user) {
            errors.push({ msg: 'El email ya está registrado' });
            return res.render('registro', {
                errors,
                nombre,
                email,
                rolSolicitado,
                datosRegistro: { titulo: 'Crear Cuenta', descripcion: 'Únete a nuestra comunidad' }
            });
        }

        // Instanciar el nuevo usuario con el rol validado
        const newUser = new User({
            nombre,
            email,
            password,
            rol: rolSolicitado
        });

        // Guardar en MongoDB (la contraseña se encripta en el hook pre-save de User.js)
        await newUser.save();

        // ── Correo de bienvenida ──────────────────────────────────────────
        const rolesLabel = { estudiante: 'Estudiante', docente: 'Docente', admin: 'Administrador' };
        const nombreSeguro = _escapeHtml(nombre);
        const message = `Hola ${nombre},\n\nGracias por unirte a Eduplat como ${rolesLabel[rolSolicitado]}. Estamos emocionados de tenerte aquí.`;
        const html    = `<p>Hola <strong>${nombreSeguro}</strong>,</p><p>Gracias por unirte a Eduplat como <strong>${rolesLabel[rolSolicitado]}</strong>. Estamos emocionados de tenerte aquí.</p>`;

        try {
            await sendEmail({
                email: newUser.email,
                subject: '¡Bienvenido a Eduplat!',
                message,
                html
            });
        } catch (emailError) {
            console.error('Error enviando email de bienvenida:', emailError);
            // No bloqueamos el flujo si falla el envío de correo.
        }

        // Iniciar sesión automáticamente usando Passport
        req.login(newUser, (err) => {
            if (err) {
                console.error('Error al hacer auto-login después del registro:', err);
                return res.redirect('/login');
            }
            req.flash('success_msg', `¡Bienvenido, ${nombre}! Tu cuenta de ${rolesLabel[rolSolicitado]} ha sido creada.`);
            return res.redirect(_panelByRole(rolSolicitado));
        });

    } catch (err) {
        console.error('Error en el registro del usuario:', err);
        res.status(500).render('error', {
            mensaje: 'Error en el servidor',
            descripcion: 'No se pudo completar el registro debido a un error interno.',
            status: 500
        });
    }
};

/**
 * @route GET /login
 * @description Muestra la vista con el formulario de inicio de sesión.
 */
exports.getLogin = (req, res) => {
    res.render('login', {
        datosLogin: {
            titulo: 'Iniciar Sesión',
            descripcion: 'Accede a tus cursos y progreso'
        }
    });
};

/**
 * @route POST /login
 * @description Procesa las credenciales de ingreso mediante la estrategia local de Passport
 * y redirige según el rol del usuario autenticado.
 */
exports.postLogin = (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err); }

        if (!user) {
            req.flash('error', info ? info.message : 'Credenciales incorrectas');
            return res.redirect('/login');
        }

        req.login(user, (loginErr) => {
            if (loginErr) { return next(loginErr); }
            // Redirigir según el rol del usuario
            return res.redirect(_panelByRole(user.rol));
        });
    })(req, res, next);
};

/**
 * @route POST /logout
 * @description Cierra la sesión activa del usuario y destruye la sesión en el servidor.
 * Se usa POST para evitar cierres de sesión por enlaces/prefetch de terceros.
 */
exports.postLogout = (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        if (!req.session) {
            return res.redirect('/');
        }
        req.session.destroy(() => {
            res.clearCookie('eduplat.sid');
            res.redirect('/');
        });
    });
};

/**
 * @helper _panelByRole
 * @description Devuelve la URL de redirección tras el login/registro según el rol.
 * @param {string} rol - El rol del usuario ('admin', 'docente', 'estudiante')
 * @returns {string} La ruta de redirección
 */
function _panelByRole(rol) {
    switch (rol) {
        case 'admin':    return '/admin/dashboard';
        case 'docente':  return '/docente/dashboard';
        default:         return '/panel';   // estudiante
    }
}

/**
 * @helper _escapeHtml
 * @description Escapa caracteres peligrosos para plantillas HTML de correo.
 * @param {string} texto Texto original.
 * @returns {string} Texto escapado.
 */
function _escapeHtml(texto) {
    return String(texto || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * @route GET /olvide-password
 * @description Muestra el formulario para solicitar restablecimiento de contraseña.
 */
exports.getOlvidePassword = (req, res) => {
    res.render('olvide-password', {
        titlePage: 'Recuperar Contraseña'
    });
};

/**
 * @route POST /olvide-password
 * @description Genera un token criptográfico, lo guarda con expiración de 1h y envía el enlace al email.
 */
exports.postOlvidePassword = async (req, res) => {
    // SEGURIDAD: string + normalización para evitar inyección NoSQL y variantes de email.
    const email = String(req.body.email || '').trim().toLowerCase();
    try {
        if (!email) {
            req.flash('error_msg', 'Por favor ingresa tu correo electrónico.');
            return res.redirect('/olvide-password');
        }

        const user = await User.findOne({ email }).collation({ locale: 'en', strength: 2 });
        if (!user) {
            req.flash('success_msg', 'Si el correo está registrado en Eduplat, recibirás un enlace de restablecimiento.');
            return res.redirect('/olvide-password');
        }

        // Generar token aleatorio
        const resetToken = crypto.randomBytes(24).toString('hex');

        // Hashear token para persistencia segura en BD
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpire = Date.now() + 3600000; // 1 hora de validez
        await user.save({ validateBeforeSave: false });

        // SEGURIDAD: la URL se construye con APP_URL, nunca con la cabecera Host
        // (evita Host-header poisoning). APP_URL es obligatoria en producción.
        const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
        const resetUrl = `${appUrl}/reset-password/${resetToken}`;
        const nombreSeguro = _escapeHtml(user.nombre);

        const mensaje = `Hola ${user.nombre},\n\nHas solicitado restablecer tu contraseña en Eduplat. Por favor ingresa al siguiente enlace para definir tu nueva clave:\n\n${resetUrl}\n\nEste enlace expirará en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo.`;

        const html = `
            <div style="font-family: sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
                <h2 style="color: #090D16; font-size: 20px; font-weight: 700; margin-bottom: 12px;">Restablecer Contraseña — Eduplat</h2>
                <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">Hola <strong>${nombreSeguro}</strong>,</p>
                <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón a continuación para crear tu nueva clave:</p>
                <div style="text-align: center; margin: 28px 0;">
                    <a href="${resetUrl}" style="background-color: #090D16; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Restablecer Contraseña</a>
                </div>
                <p style="color: #6b7280; font-size: 12px;">O copia este enlace en tu navegador:<br><a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a></p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <small style="color: #6b7280; font-size: 11px;">Este enlace es válido durante 60 minutos. Si no realizaste esta solicitud, desestima este mensaje.</small>
            </div>
        `;

        let mailResult = { success: false };
        try {
            mailResult = await sendEmail({
                email: user.email,
                subject: 'Eduplat — Restablecimiento de Contraseña',
                message: mensaje,
                html: html
            });
        } catch (mailErr) {
            console.error('Error al enviar email SMTP:', mailErr.message);
        }

        // SEGURIDAD: nunca imprimir el enlace ni datos del usuario en producción.
        if (process.env.NODE_ENV !== 'production') {
            console.log(`\n======================================================`);
            console.log(`[RECUPERACIÓN DE CONTRASEÑA — EDUPLAT]`);
            console.log(`Para: ${user.email}`);
            console.log(`Enlace de restablecimiento: ${resetUrl}`);
            if (mailResult && mailResult.previewUrl) {
                console.log(`Bandeja Ethereal (Test Inbox): ${mailResult.previewUrl}`);
            }
            console.log(`======================================================\n`);
        }

        // Mensaje genérico (no revela si el email existe) y enlace de preview escapado en la vista.
        req.flash('success_msg', 'Si el correo está registrado en Eduplat, recibirás un enlace de restablecimiento en tu bandeja de entrada.');
        if (mailResult && mailResult.previewUrl && process.env.NODE_ENV !== 'production') {
            req.flash('reset_preview_url', mailResult.previewUrl);
        }
        res.redirect('/olvide-password');

    } catch (err) {
        console.error('Error en postOlvidePassword:', err);
        req.flash('error_msg', 'Ocurrió un error al procesar la solicitud.');
        res.redirect('/olvide-password');
    }
};

/**
 * @route GET /reset-password/:token
 * @description Muestra el formulario para ingresar la nueva contraseña validando el token.
 */
exports.getResetPassword = async (req, res) => {
    try {
        const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error_msg', 'El enlace de recuperación es inválido o ya ha expirado.');
            return res.redirect('/olvide-password');
        }

        res.render('reset-password', {
            titlePage: 'Nueva Contraseña',
            token: req.params.token
        });
    } catch (err) {
        console.error('Error en getResetPassword:', err);
        req.flash('error_msg', 'Token inválido.');
        res.redirect('/olvide-password');
    }
};

/**
 * @route POST /reset-password/:token
 * @description Guarda la nueva contraseña del usuario y elimina el token de un solo uso.
 */
exports.postResetPassword = async (req, res) => {
    const token = String(req.params.token || '');
    const password = String(req.body.password || '');
    const passwordConfirmar = String(req.body.passwordConfirmar || '');

    try {
        if (!password || !passwordConfirmar) {
            req.flash('error_msg', 'Por favor completa todos los campos.');
            return res.redirect(`/reset-password/${token}`);
        }

        if (password.length < 8) {
            req.flash('error_msg', 'La contraseña debe tener al menos 8 caracteres.');
            return res.redirect(`/reset-password/${token}`);
        }

        if (password !== passwordConfirmar) {
            req.flash('error_msg', 'Las contraseñas no coinciden.');
            return res.redirect(`/reset-password/${token}`);
        }

        const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error_msg', 'El enlace es inválido o ha expirado. Solicita uno nuevo.');
            return res.redirect('/olvide-password');
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        req.flash('success_msg', '¡Contraseña actualizada con éxito! Ya puedes iniciar sesión con tu nueva clave.');
        res.redirect('/login');

    } catch (err) {
        console.error('Error en postResetPassword:', err);
        req.flash('error_msg', 'Error al guardar la nueva contraseña.');
        res.redirect(`/reset-password/${token}`);
    }
};
