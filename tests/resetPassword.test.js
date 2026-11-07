const crypto = require('crypto');
const request = require('supertest');
const User = require('../src/models/User');
const { setupTestApp, cleanupDatabase, teardownTestApp, createTestUser } = require('./helpers/testSetup');

describe('Suite de Restablecimiento de Contraseñas (resetPassword.test.js)', () => {
    let app;

    beforeAll(async () => {
        const setup = await setupTestApp();
        app = setup.app;
    });

    beforeEach(async () => {
        await cleanupDatabase();
    });

    afterAll(async () => {
        await teardownTestApp();
    });

    test('1. Flujo completo con token válido permite cambiar contraseña e iniciar sesión con la nueva', async () => {
        const rawToken = crypto.randomBytes(24).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        // Crear usuario con token válido por 1 hora
        const user = await createTestUser({
            email: 'recuperacion@test.com',
            password: 'antiguaPassword123'
        });

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpire = Date.now() + 3600000;
        await user.save({ validateBeforeSave: false });

        // 1a. Acceder al formulario de restablecimiento con el token válido
        const resGet = await request(app).get(`/reset-password/${rawToken}`);
        expect(resGet.statusCode).toBe(200);
        expect(resGet.text).toContain('Nueva Contraseña');

        // 1b. Enviar la nueva contraseña
        const resPost = await request(app).post(`/reset-password/${rawToken}`).send({
            password: 'nuevaPasswordSegura2026',
            passwordConfirmar: 'nuevaPasswordSegura2026'
        });

        expect(resPost.statusCode).toBe(302);
        expect(resPost.headers.location).toBe('/login');

        // 1c. Comprobar que el token fue eliminado de la base de datos (uso único)
        const usuarioActualizado = await User.findById(user._id);
        expect(usuarioActualizado.resetPasswordToken).toBeUndefined();
        expect(usuarioActualizado.resetPasswordExpire).toBeUndefined();

        // 1d. Comprobar que puede iniciar sesión con la nueva contraseña
        const resLogin = await request(app).post('/login').send({
            email: 'recuperacion@test.com',
            password: 'nuevaPasswordSegura2026'
        });
        expect(resLogin.statusCode).toBe(302);
        expect(resLogin.headers.location).toBe('/panel');
    });

    test('2. Un token expirado falla y es rechazado tanto en GET como en POST', async () => {
        const rawToken = crypto.randomBytes(24).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        const user = await createTestUser({
            email: 'expirado@test.com',
            password: 'password123'
        });

        // Configurar expiración en el pasado
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpire = Date.now() - 3600000; // Expiró hace 1 hora
        await user.save({ validateBeforeSave: false });

        // Intento GET con token expirado -> Redirige a /olvide-password
        const resGet = await request(app).get(`/reset-password/${rawToken}`);
        expect(resGet.statusCode).toBe(302);
        expect(resGet.headers.location).toBe('/olvide-password');

        // Intento POST con token expirado -> Redirige a /olvide-password
        const resPost = await request(app).post(`/reset-password/${rawToken}`).send({
            password: 'intentoCambio123',
            passwordConfirmar: 'intentoCambio123'
        });
        expect(resPost.statusCode).toBe(302);
        expect(resPost.headers.location).toBe('/olvide-password');
    });

    test('3. Un token ya utilizado no puede ser reusado (token replay attack)', async () => {
        const rawToken = crypto.randomBytes(24).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        const user = await createTestUser({
            email: 'reuso@test.com',
            password: 'passwordOriginal123'
        });

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpire = Date.now() + 3600000;
        await user.save({ validateBeforeSave: false });

        // Primer uso legítimo: cambia la clave
        const resPrimerUso = await request(app).post(`/reset-password/${rawToken}`).send({
            password: 'primerCambioValido123',
            passwordConfirmar: 'primerCambioValido123'
        });
        expect(resPrimerUso.statusCode).toBe(302);
        expect(resPrimerUso.headers.location).toBe('/login');

        // Segundo uso con el mismo token -> Debe fallar y redirigir a /olvide-password
        const resSegundoUso = await request(app).post(`/reset-password/${rawToken}`).send({
            password: 'segundoCambioIlegitimo123',
            passwordConfirmar: 'segundoCambioIlegitimo123'
        });
        expect(resSegundoUso.statusCode).toBe(302);
        expect(resSegundoUso.headers.location).toBe('/olvide-password');
    });
});
