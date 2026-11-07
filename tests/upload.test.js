const request = require('supertest');
const User = require('../src/models/User');
const { setupTestApp, cleanupDatabase, teardownTestApp, createTestUser } = require('./helpers/testSetup');

describe('Suite de Seguridad de Cargas de Archivos (upload.test.js)', () => {
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

    async function loginAgent(email, password) {
        const agent = request.agent(app);
        await agent.post('/login').send({ email, password });
        return agent;
    }

    test('1. Subir un archivo HTML disfrazado con mimetype image/png es rechazado por magic bytes', async () => {
        const user = await createTestUser({
            email: 'estudiante.upload@test.com',
            password: 'password123',
            rol: 'estudiante'
        });

        const agent = await loginAgent('estudiante.upload@test.com', 'password123');

        // Payload simulado: contenido HTML malicioso pero cabecera MIME image/png
        const htmlPayload = Buffer.from('<!DOCTYPE html><html><script>alert("XSS")</script></html>');

        const res = await agent.post('/configuracion/avatar').attach('avatar', htmlPayload, {
            filename: 'malicious.png',
            contentType: 'image/png'
        });

        // Debe redirigir a configuración y NO actualizar el avatar
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/configuracion');

        const usuarioActualizado = await User.findById(user._id);
        expect(usuarioActualizado.avatar).toBe('/img/default-avatar.svg');
    });

    test('2. Subir una imagen PNG real con magic bytes válidos es aceptada', async () => {
        const user = await createTestUser({
            email: 'estudiante.png@test.com',
            password: 'password123',
            rol: 'estudiante'
        });

        const agent = await loginAgent('estudiante.png@test.com', 'password123');

        // Firma binaria real de un archivo PNG válido (Magic bytes: 89 50 4E 47 0D 0A 1A 0A)
        const realPngBytes = Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
            0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d,
            0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
        ]);

        const res = await agent.post('/configuracion/avatar').attach('avatar', realPngBytes, {
            filename: 'perfil.png',
            contentType: 'image/png'
        });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/configuracion');

        const usuarioActualizado = await User.findById(user._id);
        expect(usuarioActualizado.avatar).toMatch(/^\/uploads\/avatars\/avatar-/);
        expect(usuarioActualizado.avatar).toMatch(/\.png$/);
    });

    test('3. Subir un archivo de imagen que supera los 2 MB es rechazado', async () => {
        const user = await createTestUser({
            email: 'estudiante.grande@test.com',
            password: 'password123',
            rol: 'estudiante'
        });

        const agent = await loginAgent('estudiante.grande@test.com', 'password123');

        // Generar un buffer de 2.5 MB (supera el límite de 2MB configurado en Multer)
        const oversizedBuffer = Buffer.alloc(2.5 * 1024 * 1024);
        // Colocar magic bytes de PNG al principio para simular una imagen grande legítima
        oversizedBuffer[0] = 0x89;
        oversizedBuffer[1] = 0x50;
        oversizedBuffer[2] = 0x4e;
        oversizedBuffer[3] = 0x47;
        oversizedBuffer[4] = 0x0d;
        oversizedBuffer[5] = 0x0a;
        oversizedBuffer[6] = 0x1a;
        oversizedBuffer[7] = 0x0a;

        const res = await agent.post('/configuracion/avatar').attach('avatar', oversizedBuffer, {
            filename: 'pesada.png',
            contentType: 'image/png'
        });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/configuracion');

        const usuarioActualizado = await User.findById(user._id);
        expect(usuarioActualizado.avatar).toBe('/img/default-avatar.svg');
    });
});
