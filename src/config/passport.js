/**
 * @file passport.js
 * @description Configuración de las estrategias de autenticación local con Passport.js.
 * Define cómo buscar el usuario, validar su contraseña y manejar la sesión (serialización/deserialización).
 *
 * SEGURIDAD:
 *  - El mensaje de error es genérico para no revelar si un email existe (enumeración).
 *  - Cuando el usuario no existe se compara contra un hash falso para igualar tiempos
 *    de respuesta y dificultar ataques de temporización.
 */

const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Hash de relleno generado una sola vez al arrancar (nunca se usa para autenticar).
const HASH_FALSO = bcrypt.hashSync('eduplat-timing-equalizer', 10);

/**
 * @function
 * @description Configura e inicializa la estrategia local para Passport.
 * @param {object} passport - Instancia del módulo Passport que se inicializó en el servidor principal.
 */
module.exports = function (passport) {
    // Definimos la estrategia local usando el campo 'email' como nombre de usuario principal
    passport.use(
        new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
            try {
                // Normalizamos la entrada: nunca debe llegar un objeto desde el body.
                const emailNormalizado = String(email || '')
                    .trim()
                    .toLowerCase();
                const passwordSegura = String(password || '');

                // Buscamos el usuario por email. La collation permite encontrar cuentas
                // antiguas guardadas con mayúsculas sin necesidad de migrarlas.
                const user = await User.findOne({ email: emailNormalizado })
                    .collation({ locale: 'en', strength: 2 })
                    .select('+password');

                // Si no se encuentra el usuario, comparamos contra un hash falso y
                // devolvemos el mismo mensaje genérico que una contraseña incorrecta.
                if (!user) {
                    await bcrypt.compare(passwordSegura, HASH_FALSO);
                    return done(null, false, { message: 'Credenciales incorrectas' });
                }

                // Verificamos si la contraseña coincide llamando al método del modelo de usuario
                const isMatch = await user.matchPassword(passwordSegura);

                if (!isMatch) {
                    return done(null, false, { message: 'Credenciales incorrectas' });
                }

                // Verificamos si la cuenta está activa
                if (user.activo === false) {
                    return done(null, false, {
                        message: 'Tu cuenta ha sido desactivada. Comunícate con el administrador.'
                    });
                }

                // Autenticación exitosa, retornamos el objeto del usuario
                return done(null, user);
            } catch (err) {
                console.error('Error en la estrategia de Passport:', err);
                return done(err);
            }
        })
    );

    /**
     * @description Serializar el usuario para guardar su identificador (ID) dentro de la sesión.
     */
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    /**
     * @description Deserializar el usuario a partir del ID de la sesión para reconstruir el objeto `req.user`.
     */
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
};
