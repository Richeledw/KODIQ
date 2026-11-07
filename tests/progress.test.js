const request = require('supertest');
const Course = require('../src/models/Course');
const Enrollment = require('../src/models/Enrollment');
const StudentProject = require('../src/models/StudentProject');
const { setupTestApp, cleanupDatabase, teardownTestApp, createTestUser } = require('./helpers/testSetup');

describe('Suite de Progreso Académico y Certificación (progress.test.js)', () => {
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

    async function createTestCourseWithLessons() {
        return await Course.create({
            id: 'curso-progreso',
            titulo: 'Curso de Pruebas de Progreso',
            descripcion: 'Curso para verificar cálculo y topes de avance',
            categoria: 'backend',
            nivel: 'Principiante',
            modulos: [
                {
                    titulo: 'Módulo 1: Fundamentos',
                    orden: 1,
                    lecciones: [
                        { id: 'lec-1', titulo: 'Introducción a Node.js', duracion: '10 min' },
                        { id: 'lec-2', titulo: 'Event Loop y Asincronía', duracion: '15 min' }
                    ]
                }
            ],
            proyectoConsigna: {
                titulo: 'API REST Segura con Express',
                descripcion: 'Construir una API con validaciones completas'
            }
        });
    }

    test('1. Enviar una leccionId que no existe en el curso da error 404 (JSON) o redirección de fallo', async () => {
        await createTestCourseWithLessons();
        const user = await createTestUser({
            email: 'estudiante.progreso@test.com',
            password: 'password123',
            rol: 'estudiante'
        });

        // Inscribir al estudiante
        await Enrollment.create({
            estudiante: user._id,
            cursoId: 'curso-progreso',
            progreso: 0,
            leccionesCompletadas: []
        });

        const agent = await loginAgent('estudiante.progreso@test.com', 'password123');

        // Solicitud AJAX con una lección inventada / inexistente
        const resJson = await agent
            .post('/curso/curso-progreso/leccion/leccion-inexistente-999/completar')
            .set('Accept', 'application/json');

        expect(resJson.statusCode).toBe(404);
        expect(resJson.body.success).toBe(false);
        expect(resJson.body.msg).toMatch(/Lección no encontrada/i);
    });

    test('2. El progreso se actualiza correctamente y nunca supera el 100%', async () => {
        const curso = await createTestCourseWithLessons();
        const user = await createTestUser({
            email: 'estudiante.100@test.com',
            password: 'password123',
            rol: 'estudiante'
        });

        await Enrollment.create({
            estudiante: user._id,
            cursoId: curso.id,
            progreso: 0,
            leccionesCompletadas: []
        });

        const agent = await loginAgent('estudiante.100@test.com', 'password123');

        // Completar lección 1 (1 de 2 = 50%)
        const res1 = await agent.post(`/curso/${curso.id}/leccion/lec-1/completar`).set('Accept', 'application/json');
        expect(res1.statusCode).toBe(200);
        expect(res1.body.progreso).toBe(50);

        // Completar lección 2 (2 de 2 = 100%)
        const res2 = await agent.post(`/curso/${curso.id}/leccion/lec-2/completar`).set('Accept', 'application/json');
        expect(res2.statusCode).toBe(200);
        expect(res2.body.progreso).toBe(100);

        // Verificar en base de datos que el progreso registrado es exactamente 100 y no mayor
        const inscripcionDb = await Enrollment.findOne({ estudiante: user._id, cursoId: curso.id });
        expect(inscripcionDb.progreso).toBeLessThanOrEqual(100);
        expect(inscripcionDb.progreso).toBe(100);
    });

    test('3. El certificado oficial se deniega si no tiene 100% de lecciones + proyecto aprobado', async () => {
        const curso = await createTestCourseWithLessons();
        const user = await createTestUser({
            email: 'estudiante.cert@test.com',
            password: 'password123',
            rol: 'estudiante'
        });

        const agent = await loginAgent('estudiante.cert@test.com', 'password123');

        // Caso 3a: Sin lecciones y sin proyecto -> Denegado (302 a aula)
        await Enrollment.create({
            estudiante: user._id,
            cursoId: curso.id,
            progreso: 0,
            leccionesCompletadas: []
        });

        const resCertSinNada = await agent.get(`/curso/${curso.id}/certificado`);
        expect(resCertSinNada.statusCode).toBe(302);
        expect(resCertSinNada.headers.location).toBe(`/curso/${curso.id}/aula`);

        // Caso 3b: Lecciones al 100%, pero proyecto en estado "En Revisión" -> Denegado (302 a aula)
        await Enrollment.updateOne(
            { estudiante: user._id, cursoId: curso.id },
            { progreso: 100, leccionesCompletadas: ['lec-1', 'lec-2'] }
        );

        await StudentProject.create({
            estudiante: user._id,
            estudianteNombre: user.nombre,
            estudianteEmail: user.email,
            cursoId: curso.id,
            cursoTitulo: curso.titulo,
            titulo: 'Mi Proyecto',
            estado: 'En Revisión'
        });

        const resCertNoAprobado = await agent.get(`/curso/${curso.id}/certificado`);
        expect(resCertNoAprobado.statusCode).toBe(302);
        expect(resCertNoAprobado.headers.location).toBe(`/curso/${curso.id}/aula`);

        // Caso 3c: Lecciones al 100% Y proyecto aprobado por docente ("Completado") -> Permitido (200 OK)
        await StudentProject.updateOne({ estudiante: user._id, cursoId: curso.id }, { estado: 'Completado' });

        const resCertAprobado = await agent.get(`/curso/${curso.id}/certificado`);
        expect(resCertAprobado.statusCode).toBe(200);
        expect(resCertAprobado.text).toContain('CERTIFICADO DE FINALIZACIÓN');
    });
});
