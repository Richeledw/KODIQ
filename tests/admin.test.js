const request = require('supertest');
const User = require('../src/models/User');
const { setupTestApp, cleanupDatabase, teardownTestApp, createTestUser } = require('./helpers/testSetup');

describe('Suite de Seguridad de Administración y Anti-Lockout (admin.test.js)', () => {
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

    test('1. Un administrador no puede eliminarse a sí mismo', async () => {
        const admin = await createTestUser({
            nombre: 'Admin Principal',
            email: 'admin.self@test.com',
            password: 'password123',
            rol: 'admin'
        });

        const agent = await loginAgent('admin.self@test.com', 'password123');

        // Intento de auto-eliminación
        const res = await agent.post(`/admin/usuarios/${admin._id}/eliminar`);
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/admin/usuarios');

        // Comprobar que sigue existiendo en la base de datos
        const adminDb = await User.findById(admin._id);
        expect(adminDb).not.toBeNull();
        expect(adminDb.email).toBe('admin.self@test.com');
    });

    test('2. Un administrador no puede desactivarse a sí mismo', async () => {
        const admin = await createTestUser({
            nombre: 'Admin Self Toggle',
            email: 'admin.toggle@test.com',
            password: 'password123',
            rol: 'admin',
            activo: true
        });

        const agent = await loginAgent('admin.toggle@test.com', 'password123');

        // Intento de auto-desactivación
        const res = await agent.post(`/admin/usuarios/${admin._id}/toggle-estado`);
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/admin/usuarios');

        // Comprobar que sigue activo
        const adminDb = await User.findById(admin._id);
        expect(adminDb.activo).toBe(true);
    });

    test('3. Un administrador no puede quitarse a sí mismo el rol de admin', async () => {
        const admin = await createTestUser({
            nombre: 'Admin Demote',
            email: 'admin.demote@test.com',
            password: 'password123',
            rol: 'admin'
        });

        const agent = await loginAgent('admin.demote@test.com', 'password123');

        // Intento de auto-degradación a estudiante
        const res = await agent.post(`/admin/usuarios/${admin._id}/rol`).send({ rol: 'estudiante' });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/admin/usuarios');

        const adminDb = await User.findById(admin._id);
        expect(adminDb.rol).toBe('admin');
    });

    test('4. No se puede eliminar, desactivar o degradar al último administrador activo (anti-lockout)', async () => {
        // Creamos dos administradores: Admin A (en sesión) y Admin B
        const adminA = await createTestUser({
            nombre: 'Admin A',
            email: 'adminA@test.com',
            password: 'password123',
            rol: 'admin',
            activo: true
        });

        const adminB = await createTestUser({
            nombre: 'Admin B',
            email: 'adminB@test.com',
            password: 'password123',
            rol: 'admin',
            activo: true
        });

        // Si desactivamos primero a Admin A directamente en BD para que solo quede Admin B como único admin activo:
        await User.findByIdAndUpdate(adminA._id, { activo: false });

        // Ahora Admin B es el ÚLTIMO administrador activo en el sistema.
        // Eliminamos Admin A para probar con Admin B como único admin:
        await User.findByIdAndDelete(adminA._id);

        // Iniciamos sesión como Admin B
        const agentB = await loginAgent('adminB@test.com', 'password123');

        // 4a. Intento de degradar al último admin activo mediante POST /admin/usuarios/:id/rol
        const resDegradar = await agentB.post(`/admin/usuarios/${adminB._id}/rol`).send({ rol: 'docente' });
        expect(resDegradar.statusCode).toBe(302);

        const adminVerif1 = await User.findById(adminB._id);
        expect(adminVerif1.rol).toBe('admin');

        // 4b. Intento de desactivar al último admin activo mediante POST /admin/usuarios/:id/toggle-estado
        const resDesactivar = await agentB.post(`/admin/usuarios/${adminB._id}/toggle-estado`);
        expect(resDesactivar.statusCode).toBe(302);

        const adminVerif2 = await User.findById(adminB._id);
        expect(adminVerif2.activo).toBe(true);

        // 4c. Intento de eliminar al último admin activo mediante POST /admin/usuarios/:id/eliminar
        const resEliminar = await agentB.post(`/admin/usuarios/${adminB._id}/eliminar`);
        expect(resEliminar.statusCode).toBe(302);

        const adminVerif3 = await User.findById(adminB._id);
        expect(adminVerif3).not.toBeNull();
    });
});
