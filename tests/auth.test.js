const request = require('supertest');
const User = require('../src/models/User');
const { setupTestApp, cleanupDatabase, teardownTestApp, createTestUser } = require('./helpers/testSetup');

describe('Suite de Autenticación (auth.test.js)', () => {
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

    test('1. El registro público SIEMPRE fuerza el rol estudiante', async () => {
        const res = await request(app).post('/registro').send({
            nombre: 'Hacker Intent',
            email: 'hacker@test.com',
            password: 'password123',
            rol: 'admin' // Intento malicioso de escalar privilegios
        });

        // Debe redirigir al panel tras crearse e iniciar sesión exitosamente
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/panel');

        // Comprobar que en base de datos el rol fue forzado a 'estudiante'
        const usuarioCreado = await User.findOne({ email: 'hacker@test.com' });
        expect(usuarioCreado).toBeDefined();
        expect(usuarioCreado.rol).toBe('estudiante');
    });

    test('2. Login con credenciales erróneas redirige con fallo (sin enumeración de usuarios)', async () => {
        await createTestUser({
            email: 'usuario.real@test.com',
            password: 'passwordSegura123'
        });

        // Caso 2a: Usuario existe pero contraseña incorrecta
        const resPassErr = await request(app).post('/login').send({
            email: 'usuario.real@test.com',
            password: 'wrongPassword999'
        });
        expect(resPassErr.statusCode).toBe(302);
        expect(resPassErr.headers.location).toBe('/login');

        // Caso 2b: Usuario no existe
        const resNoUser = await request(app).post('/login').send({
            email: 'inexistente@test.com',
            password: 'cualquierPassword'
        });
        expect(resNoUser.statusCode).toBe(302);
        expect(resNoUser.headers.location).toBe('/login');
    });

    test('3. Login con usuario desactivado (activo: false) es rechazado', async () => {
        await createTestUser({
            email: 'desactivado@test.com',
            password: 'password123',
            activo: false
        });

        const res = await request(app).post('/login').send({
            email: 'desactivado@test.com',
            password: 'password123'
        });

        // Debe fallar y redirigir a /login
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/login');
    });

    test('4. Rate limit salta con código 429 tras superar el umbral de intentos', async () => {
        // En rateLimiters.js, registerLimiter tiene un límite de 5 peticiones por ventana.
        // Hacemos 5 peticiones válidas/inválidas seguidas con la misma IP simulada.
        for (let i = 0; i < 5; i++) {
            await request(app)
                .post('/registro')
                .send({
                    nombre: `Usuario ${i}`,
                    email: `user${i}@ratelimit.com`,
                    password: 'password123'
                });
        }

        // La sexta petición debe ser bloqueada por rate limiting con HTTP 429
        const resBloqueado = await request(app).post('/registro').send({
            nombre: 'Usuario 6',
            email: 'user6@ratelimit.com',
            password: 'password123'
        });

        expect(resBloqueado.statusCode).toBe(429);
        expect(resBloqueado.headers.location).toBe('/registro');
    });
});
