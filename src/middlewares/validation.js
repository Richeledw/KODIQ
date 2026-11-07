/**
 * @file validation.js
 * @description Esquemas de validación centralizados con express-validator.
 *
 * Reglas de diseño:
 *  - Todo valor que llega del cliente se convierte primero a string. Así evitamos
 *    que un payload como `email[$gt]=` se trate como objeto (NoSQL injection).
 *  - Los emails se normalizan con trim + minúsculas.
 *  - Las contraseñas nuevas exigen mínimo 8 caracteres; el login no exige longitud
 *    para no romper cuentas antiguas con contraseñas más cortas.
 */

const { body, param, validationResult } = require('express-validator');

/** Convierte cualquier valor a string seguro (nunca devuelve objetos). */
const aTexto = (valor) => {
    if (valor === undefined || valor === null) return '';
    return typeof valor === 'string' ? valor : String(valor);
};

/** Regla común para emails. */
const emailRule = body('email')
    .customSanitizer(aTexto)
    .trim()
    .toLowerCase()
    .isLength({ max: 254 })
    .withMessage('El correo electrónico es demasiado largo.')
    .isEmail()
    .withMessage('Ingresa un correo electrónico válido.');

/** Regla común para textos obligatorios. */
const textoObligatorio = (campo, etiqueta, min = 1, max = 255) =>
    body(campo)
        .customSanitizer(aTexto)
        .trim()
        .isLength({ min, max })
        .withMessage(`${etiqueta} debe tener entre ${min} y ${max} caracteres.`);

/** Regla común para textos opcionales. */
const textoOpcional = (campo, etiqueta, max = 1000) =>
    body(campo)
        .optional({ values: 'falsy' })
        .customSanitizer(aTexto)
        .trim()
        .isLength({ max })
        .withMessage(`${etiqueta} no puede superar ${max} caracteres.`);

/**
 * Ejecuta las reglas y, si fallan, guarda un flash y redirige.
 * @param {Array} reglas Reglas de express-validator.
 * @param {string|Function} redirectTo Ruta fija o función (req) => ruta.
 * @returns {Function} Middleware.
 */
function validar(reglas, redirectTo) {
    return async (req, res, next) => {
        await Promise.all(reglas.map((regla) => regla.run(req)));

        const errores = validationResult(req);
        if (!errores.isEmpty()) {
            const primerError = errores.array()[0].msg;
            req.flash('error_msg', primerError);
            const destino = typeof redirectTo === 'function' ? redirectTo(req) : redirectTo;
            return res.redirect(destino);
        }
        return next();
    };
}

// ── Autenticación ──────────────────────────────────────────────────────────
const validarRegistro = validar(
    [
        textoObligatorio('nombre', 'El nombre', 2, 80),
        emailRule,
        body('password')
            .customSanitizer(aTexto)
            .isLength({ min: 8, max: 128 })
            .withMessage('La contraseña debe tener al menos 8 caracteres.')
    ],
    '/registro'
);

const validarLogin = validar(
    [emailRule, body('password').customSanitizer(aTexto).notEmpty().withMessage('Debes ingresar tu contraseña.')],
    '/login'
);

const validarOlvidePassword = validar([emailRule], '/olvide-password');

const validarResetPassword = validar(
    [
        body('password')
            .customSanitizer(aTexto)
            .isLength({ min: 8, max: 128 })
            .withMessage('La nueva contraseña debe tener al menos 8 caracteres.'),
        body('passwordConfirmar')
            .customSanitizer(aTexto)
            .custom((valor, { req }) => valor === req.body.password)
            .withMessage('Las contraseñas no coinciden.')
    ],
    (req) => `/reset-password/${req.params.token}`
);

// El token se genera con 24 bytes aleatorios en hexadecimal (48 caracteres).
// Rechazarlo antes de consultar evita expresiones raras y consultas innecesarias.
const validarTokenReset = validar(
    [
        param('token')
            .customSanitizer(aTexto)
            .isLength({ min: 48, max: 48 })
            .matches(/^[a-f0-9]+$/i)
            .withMessage('El enlace de recuperación no es válido.')
    ],
    '/olvide-password'
);

// ── Perfil ─────────────────────────────────────────────────────────────────
const validarPerfil = validar(
    [
        textoObligatorio('nombre', 'El nombre', 2, 80),
        emailRule,
        textoOpcional('telefono', 'El teléfono', 30),
        textoOpcional('ciudad', 'La ciudad', 80),
        textoOpcional('bio', 'La biografía', 1000)
    ],
    '/configuracion'
);

const validarCambioPassword = validar(
    [
        body('passwordActual').customSanitizer(aTexto).notEmpty().withMessage('Debes ingresar tu contraseña actual.'),
        body('passwordNueva')
            .customSanitizer(aTexto)
            .isLength({ min: 8, max: 128 })
            .withMessage('La nueva contraseña debe tener al menos 8 caracteres.'),
        body('passwordConfirmar')
            .customSanitizer(aTexto)
            .custom((valor, { req }) => valor === req.body.passwordNueva)
            .withMessage('Las nuevas contraseñas no coinciden.')
    ],
    '/configuracion'
);

// ── Contacto ───────────────────────────────────────────────────────────────
const validarContacto = validar(
    [
        textoObligatorio('nombre', 'El nombre', 2, 100),
        emailRule,
        textoObligatorio('asunto', 'El asunto', 3, 150),
        textoObligatorio('mensaje', 'El mensaje', 10, 5000)
    ],
    '/contacto'
);

// ── Cursos, módulos, lecciones y recursos ─────────────────────────────────
const validarCurso = validar(
    [
        body('id')
            .optional({ values: 'falsy' })
            .customSanitizer(aTexto)
            .trim()
            .matches(/^[a-z0-9-]{2,80}$/i)
            .withMessage('El identificador del curso solo admite letras, números y guiones.'),
        textoObligatorio('titulo', 'El título', 3, 120),
        textoObligatorio('descripcion', 'La descripción', 10, 300),
        textoOpcional('descripcionLarga', 'La descripción larga', 5000),
        body('categoria')
            .optional({ values: 'falsy' })
            .isIn(['web', 'backend', 'datos', 'diseno', 'mobile', 'devops'])
            .withMessage('La categoría no es válida.'),
        body('nivel')
            .optional({ values: 'falsy' })
            .isIn(['Beginner', 'Intermediate', 'Advanced', 'Principiante', 'Intermedio', 'Avanzado'])
            .withMessage('El nivel no es válido.'),
        textoOpcional('duracion', 'La duración', 50),
        textoOpcional('icono', 'El icono', 200),
        textoOpcional('color', 'El color', 30),
        textoOpcional('autorNombre', 'El nombre del autor', 100),
        textoOpcional('proyectoTitulo', 'El título del proyecto', 150),
        textoOpcional('proyectoDescripcion', 'La descripción del proyecto', 2000)
    ],
    (req) => {
        if (req.originalUrl.includes('/admin/')) return '/admin/cursos';
        return req.params.id ? `/docente/cursos/${req.params.id}/editar` : '/docente/cursos/nuevo';
    }
);

const validarModulo = validar(
    [
        textoObligatorio('titulo', 'El título del módulo', 2, 150),
        textoOpcional('descripcion', 'La descripción del módulo', 2000)
    ],
    (req) => `${req.originalUrl.split('/modulo/')[0]}/contenido`
);

const validarLeccion = validar(
    [
        textoObligatorio('titulo', 'El título de la lección', 2, 150),
        textoOpcional('duracion', 'La duración', 50),
        body('videoUrl')
            .optional({ values: 'falsy' })
            .customSanitizer(aTexto)
            .trim()
            .isURL({ require_protocol: true })
            .withMessage('La URL del video no es válida.'),
        textoOpcional('explicacionDetallada', 'La explicación', 10000),
        textoOpcional('codigoEjemplo', 'El código de ejemplo', 20000),
        textoOpcional('lenguajeCodigo', 'El lenguaje', 30)
    ],
    (req) => `${req.originalUrl.split('/modulo/')[0]}/contenido`
);

const validarRecurso = validar(
    [
        textoObligatorio('titulo', 'El título del recurso', 2, 150),
        body('tipo')
            .optional({ values: 'falsy' })
            .isIn(['pdf', 'link', 'github', 'zip', 'guia', 'archivo'])
            .withMessage('El tipo de recurso no es válido.'),
        body('url')
            .customSanitizer(aTexto)
            .trim()
            .isLength({ min: 1, max: 500 })
            .withMessage('La URL o ruta del recurso es obligatoria.')
            .custom((valor) => /^https?:\/\//i.test(valor) || valor.startsWith('/'))
            .withMessage('La URL del recurso debe empezar por http(s):// o por /.'),
        textoOpcional('descripcion', 'La descripción del recurso', 1000)
    ],
    (req) => `${req.originalUrl.split('/recurso/')[0]}/contenido`
);

// ── Proyectos y administración ────────────────────────────────────────────
const validarRetroalimentacion = validar(
    [
        textoOpcional('comentario', 'El comentario', 2000),
        body('calificacion')
            .optional({ values: 'falsy' })
            .isFloat({ min: 0, max: 100 })
            .withMessage('La calificación debe estar entre 0 y 100.'),
        body('estado')
            .optional({ values: 'falsy' })
            .isIn(['En Progreso', 'En Revisión', 'Completado'])
            .withMessage('El estado del proyecto no es válido.')
    ],
    (req) => (req.originalUrl.includes('/admin/') ? '/admin/proyectos' : '/docente/proyectos')
);

// Proyecto práctico guardado por el estudiante. Los enlaces solo admiten
// http(s) para no permitir esquemas peligrosos como javascript: o data:.
const urlProyecto = (campo, etiqueta) =>
    body(campo)
        .optional({ values: 'falsy' })
        .customSanitizer(aTexto)
        .trim()
        .isLength({ max: 500 })
        .withMessage(`${etiqueta} no puede superar 500 caracteres.`)
        .custom((valor) => /^https?:\/\//i.test(valor))
        .withMessage(`${etiqueta} debe empezar por http:// o https://.`);

const validarProyecto = validar(
    [
        textoOpcional('titulo', 'El título del proyecto', 150),
        textoOpcional('descripcion', 'La descripción del proyecto', 5000),
        textoOpcional('notasAvance', 'Las notas de avance', 10000),
        urlProyecto('repositorioUrl', 'La URL del repositorio'),
        urlProyecto('despliegueUrl', 'La URL del despliegue'),
        urlProyecto('videoDemoUrl', 'La URL del video de demostración'),
        body('estado')
            .optional({ values: 'falsy' })
            .customSanitizer(aTexto)
            .isIn(['En Progreso', 'En Revisión'])
            .withMessage('El estado del proyecto no es válido.')
    ],
    (req) => `/curso/${req.params.id}/aula`
);

const validarRol = validar(
    [body('rol').isIn(['estudiante', 'docente', 'admin']).withMessage('Rol especificado no válido.')],
    '/admin/usuarios'
);

const validarUsuarioId = validar(
    [param('id').isMongoId().withMessage('El identificador de usuario no es válido.')],
    '/admin/usuarios'
);

const validarProyectoId = validar(
    [param('id').isMongoId().withMessage('El identificador de proyecto no es válido.')],
    (req) => (req.originalUrl.includes('/admin/') ? '/admin/proyectos' : '/docente/proyectos')
);

module.exports = {
    aTexto,
    validar,
    validarRegistro,
    validarLogin,
    validarOlvidePassword,
    validarResetPassword,
    validarTokenReset,
    validarPerfil,
    validarCambioPassword,
    validarContacto,
    validarCurso,
    validarModulo,
    validarLeccion,
    validarRecurso,
    validarRetroalimentacion,
    validarProyecto,
    validarRol,
    validarUsuarioId,
    validarProyectoId
};
