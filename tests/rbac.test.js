const request = require('supertest');
const Course = require('../src/models/Course');
const { setupTestApp, cleanupDatabase, teardownTestApp, createTestUser } = require('./helpers/testSetup');

describe('Suite de Control de Acceso Basado en Roles (rbac.test.js)', () => {
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

    // Función auxiliar para autenticar un agente con una sesión activa
    async function loginAgent(email, password) {
        const agent = request.agent(app);
        const res = await agent.post('/login').send({ email, password });
        expect(res.statusCode).toBe(302);
        return agent;
    }

    test('1. Un estudiante no puede acceder a rutas de /admin/* ni /docente/* (302/403 a /panel)', async () => {
        await createTestUser({
            email: 'estudiante@test.com',
            password: 'password123',
            rol: 'estudiante'
        });

        const agent = await loginAgent('estudiante@test.com', 'password123');

        // Intento de acceso a panel administrativo
        const resAdmin = await agent.get('/admin/dashboard');
        expect(resAdmin.statusCode).toBe(302);
        expect(resAdmin.headers.location).toBe('/panel');

        // Intento de acceso a panel docente
        const resDocente = await agent.get('/docente/dashboard');
        expect(resDocente.statusCode).toBe(302);
        expect(resDocente.headers.location).toBe('/panel');
    });

    test('2. Docente A no puede ver, editar ni eliminar cursos creados por Docente B (anti-IDOR)', async () => {
        await createTestUser({
            nombre: 'Docente A',
            email: 'docenteA@test.com',
            password: 'password123',
            rol: 'docente'
        });

        const docenteB = await createTestUser({
            nombre: 'Docente B',
            email: 'docenteB@test.com',
            password: 'password123',
            rol: 'docente'
        });

        // Crear un curso perteneciente a Docente B
        await Course.create({
            id: 'curso-docente-b',
            titulo: 'Curso Exclusivo de Docente B',
            descripcion: 'Descripción técnica del curso B',
            autor: docenteB._id,
            autorNombre: docenteB.nombre,
            categoria: 'backend',
            nivel: 'Intermedio',
            duracion: '10 horas'
        });

        // Iniciar sesión con Docente A
        const agentDocenteA = await loginAgent('docenteA@test.com', 'password123');

        // Intento 2a: Docente A intenta ver contenido del curso de Docente B
        const resVer = await agentDocenteA.get('/docente/cursos/curso-docente-b/contenido');
        expect(resVer.statusCode).toBe(403);
        expect(resVer.headers.location).toBe('/docente/dashboard');

        // Intento 2b: Docente A intenta editar el curso de Docente B
        const resEditar = await agentDocenteA.get('/docente/cursos/curso-docente-b/editar');
        expect(resEditar.statusCode).toBe(403);
        expect(resEditar.headers.location).toBe('/docente/dashboard');

        // Intento 2c: Docente A intenta eliminar el curso de Docente B
        const resEliminar = await agentDocenteA.post('/docente/cursos/curso-docente-b/eliminar');
        expect(resEliminar.statusCode).toBe(403);
        expect(resEliminar.headers.location).toBe('/docente/dashboard');

        // Comprobar que el curso de Docente B no fue eliminado
        const cursoSigueExistiendo = await Course.findOne({ id: 'curso-docente-b' });
        expect(cursoSigueExistiendo).not.toBeNull();
    });

    test('3. Curso sin autor definido (semilla inicial) solo puede ser gestionado por un admin', async () => {
        await createTestUser({
            email: 'docente.comun@test.com',
            password: 'password123',
            rol: 'docente'
        });

        await createTestUser({
            email: 'admin.master@test.com',
            password: 'password123',
            rol: 'admin'
        });

        // Crear curso sin autor (como los cursos sembrados por defecto)
        await Course.create({
            id: 'curso-sin-autor',
            titulo: 'Curso Semilla Sin Autor',
            descripcion: 'Curso base del sistema sin autor',
            autor: null,
            categoria: 'web',
            nivel: 'Principiante',
            duracion: '5 horas'
        });

        // 3a. Docente intenta acceder -> Debe recibir 403
        const agentDocente = await loginAgent('docente.comun@test.com', 'password123');
        const resDocente = await agentDocente.get('/docente/cursos/curso-sin-autor/editar');
        expect(resDocente.statusCode).toBe(403);
        expect(resDocente.headers.location).toBe('/docente/dashboard');

        // 3b. Administrador intenta acceder a la gestión del curso -> Debe recibir 200 OK
        const agentAdmin = await loginAgent('admin.master@test.com', 'password123');
        const resAdmin = await agentAdmin.get('/admin/cursos/curso-sin-autor/contenido');
        expect(resAdmin.statusCode).toBe(200);
    });
});
