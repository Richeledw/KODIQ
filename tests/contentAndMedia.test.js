const request = require('supertest');
const mongoose = require('mongoose');
const Course = require('../src/models/Course');
const Module = require('../src/models/Module');
const Lesson = require('../src/models/Lesson');
const Enrollment = require('../src/models/Enrollment');
const contentService = require('../src/services/contentService');
const mediaService = require('../src/services/mediaService');
const progressService = require('../src/services/progressService');
const { migrarContenidoPendiente } = require('../src/services/contentMigration');
const { setupTestApp, cleanupDatabase, teardownTestApp, createTestUser } = require('./helpers/testSetup');

describe('Suite de Base de Datos de Contenido Extendido, Bloques y GridFS (contentAndMedia.test.js)', () => {
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

    // Construye un buffer MP4 mínimo válido (caja ftyp en bytes 4..7)
    function crearMp4Valido(tamanoExtra = 64) {
        const header = Buffer.from([
            0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00, 0x69, 0x73,
            0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32
        ]);
        return Buffer.concat([header, Buffer.alloc(tamanoExtra, 0x42)]);
    }

    // Construye un buffer PDF mínimo válido (%PDF-1.7)
    function crearPdfValido() {
        return Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n', 'utf-8');
    }

    test('1. Módulos y lecciones largas se guardan en colecciones independientes con múltiples bloques, capítulos, subtítulos y quizzes', async () => {
        const docente = await createTestUser({
            nombre: 'Prof. Ada',
            email: 'ada@eduplat.com',
            password: 'password123',
            rol: 'docente'
        });

        const curso = await Course.create({
            id: 'arquitectura-avanzada',
            titulo: 'Arquitectura de Software Avanzada',
            descripcion: 'Curso profundo con lecciones largas y múltiples recursos',
            categoria: 'backend',
            nivel: 'Avanzado',
            autor: docente._id,
            autorNombre: docente.nombre
        });

        // Subir un video MP4, un archivo de subtítulos VTT y un PDF a GridFS
        const videoAsset = await mediaService.subirBuffer(crearMp4Valido(128), {
            nombreOriginal: 'clase-magistral.mp4',
            mimeType: 'video/mp4',
            curso,
            usuario: docente
        });

        const vttBuffer = Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nBienvenidos al módulo.\n', 'utf-8');
        const subAsset = await mediaService.subirBuffer(vttBuffer, {
            nombreOriginal: 'subtitulos-es.vtt',
            mimeType: 'text/vtt',
            curso,
            usuario: docente
        });

        const pdfAsset = await mediaService.subirBuffer(crearPdfValido(), {
            nombreOriginal: 'guia-arquitectura.pdf',
            mimeType: 'application/pdf',
            curso,
            usuario: docente
        });

        const modulo = await contentService.crearModulo(curso, {
            titulo: 'Módulo 1: Sistemas Distribuidos y Consistencia',
            descripcion: 'Estudio exhaustivo de particiones, replicación y consenso.'
        });

        const textoLargo = '# Teoría de Sistemas Distribuidos\n\n' + 'Contenido técnico detallado. '.repeat(500);

        const leccion = await contentService.crearLeccion(curso, modulo._id, {
            id: 'arq-m1-l1',
            titulo: 'Teorema CAP, PACELC y Consenso Raft',
            duracion: '1h 15 min',
            bloques: [
                {
                    tipo: 'video',
                    titulo: 'Parte 1: Explicación en Video Propio (GridFS)',
                    proveedor: 'archivo',
                    asset: videoAsset._id,
                    duracionSeg: 1800,
                    transcripcion: 'Transcripción completa de la primera parte de la clase...',
                    capitulos: [
                        { titulo: 'Introducción al Teorema CAP', segundoInicio: 0 },
                        { titulo: 'El modelo PACELC en la práctica', segundoInicio: 420 },
                        { titulo: 'Demostración de partición de red', segundoInicio: 1150 }
                    ],
                    subtitulos: [
                        {
                            idioma: 'es',
                            etiqueta: 'Español',
                            asset: subAsset._id
                        }
                    ]
                },
                {
                    tipo: 'texto',
                    titulo: 'Apuntes Completos de la Clase',
                    formato: 'markdown',
                    contenido: textoLargo
                },
                {
                    tipo: 'codigo',
                    titulo: 'Implementación de Heartbeat en un Nodo',
                    lenguaje: 'javascript',
                    nombreArchivo: 'raftNode.js',
                    contenido: 'export class RaftNode { constructor(id) { this.id = id; this.term = 0; } }'
                },
                {
                    tipo: 'archivo',
                    titulo: 'Paper y Guía en PDF',
                    asset: pdfAsset._id,
                    descripcion: 'Lectura obligatoria con diagramas de secuencia'
                },
                {
                    tipo: 'quiz',
                    titulo: 'Comprobación rápida de lectura',
                    puntajeMinimo: 70,
                    preguntas: [
                        {
                            pregunta: '¿Qué evalúa la extensión PACELC cuando NO hay partición (Else)?',
                            opciones: [
                                'El equilibrio entre Latencia (L) y Consistencia (C)',
                                'El tamaño en disco de los logs',
                                'El número de clientes HTTP'
                            ],
                            respuestaCorrecta: 0,
                            explicacion: 'Sin particiones, PACELC modela el trade-off entre Latencia y Consistencia.'
                        }
                    ]
                }
            ]
        });

        expect(leccion.duracionMin).toBe(75);
        expect(leccion.tiposContenido).toEqual(expect.arrayContaining(['video', 'texto', 'codigo', 'archivo', 'quiz']));
        expect(leccion.bloques[0].capitulos).toHaveLength(3);
        expect(leccion.bloques[0].subtitulos).toHaveLength(1);

        // Verificar estadísticas desnormalizadas en Course
        const cursoActualizado = await Course.findById(curso._id);
        expect(cursoActualizado.estadisticas.modulos).toBe(1);
        expect(cursoActualizado.estadisticas.lecciones).toBe(1);
        expect(cursoActualizado.estadisticas.minutos).toBe(75);
        expect(cursoActualizado.estadisticas.archivos).toBe(3);

        // Verificar que cargarLeccion hidrata las URLs internas (/media/:id)
        const leccionHidratada = await contentService.cargarLeccion(curso, 'arq-m1-l1');
        expect(leccionHidratada.videoUrl).toBe(`/media/${videoAsset._id}`);
        expect(leccionHidratada.bloques[0].subtitulos[0].url).toBe(`/media/${subAsset._id}`);
        expect(leccionHidratada.recursos.some((r) => r.url === `/media/${pdfAsset._id}`)).toBe(true);
    });

    test('2. Seguridad GridFS: control de acceso por inscripción, soporte HTTP Range (206) y bloqueo de borrado si está en uso', async () => {
        const docente = await createTestUser({
            nombre: 'Docente Media',
            email: 'docente.media@test.com',
            password: 'password123',
            rol: 'docente'
        });
        const estudianteInscrito = await createTestUser({
            nombre: 'Estudiante Inscrito',
            email: 'inscrito@test.com',
            password: 'password123',
            rol: 'estudiante'
        });
        await createTestUser({
            nombre: 'Estudiante Externo',
            email: 'externo@test.com',
            password: 'password123',
            rol: 'estudiante'
        });

        const curso = await Course.create({
            id: 'curso-gridfs',
            titulo: 'Curso con Video en GridFS',
            descripcion: 'Pruebas de streaming y permisos',
            categoria: 'web',
            autor: docente._id
        });

        const modulo = await contentService.crearModulo(curso, { titulo: 'Módulo Único' });

        // 2a. Subir archivo mediante el endpoint HTTP de docente (/curso/:id/media/subir)
        const agentDocente = await loginAgent('docente.media@test.com', 'password123');
        const mp4Bytes = crearMp4Valido(200);

        const resSubida = await agentDocente
            .post(`/curso/${curso.id}/media/subir`)
            .set('Accept', 'application/json')
            .field('titulo', 'Video Clase 1')
            .attach('archivo', mp4Bytes, { filename: 'clase1.mp4', contentType: 'video/mp4' });

        expect(resSubida.statusCode).toBe(201);
        expect(resSubida.body.success).toBe(true);
        const assetId = resSubida.body.asset._id;

        // 2b. Un archivo HTML falso con mimetype video/mp4 es rechazado por magic bytes (415)
        const resFalso = await agentDocente
            .post(`/curso/${curso.id}/media/subir`)
            .set('Accept', 'application/json')
            .attach('archivo', Buffer.from('<html><script>alert(1)</script></html>'), {
                filename: 'exploit.mp4',
                contentType: 'video/mp4'
            });
        expect(resFalso.statusCode).toBe(415);

        // Asociar el video válido a una lección privada
        await contentService.crearLeccion(curso, modulo._id, {
            id: 'lec-privada',
            titulo: 'Lección Privada con Video',
            vistaPrevia: false,
            bloques: [{ tipo: 'video', proveedor: 'archivo', asset: assetId }]
        });

        // 2c. Visitante anónimo -> 401
        const resAnon = await request(app).get(`/media/${assetId}`);
        expect(resAnon.statusCode).toBe(401);

        // 2d. Estudiante NO inscrito -> 403
        const agentExterno = await loginAgent('externo@test.com', 'password123');
        const resNoInscrito = await agentExterno.get(`/media/${assetId}`);
        expect(resNoInscrito.statusCode).toBe(403);

        // 2e. Inscribir al estudiante -> ahora puede hacer streaming con HTTP Range (206 Partial Content)
        await progressService.crearInscripcion(estudianteInscrito, curso);
        const agentInscrito = await loginAgent('inscrito@test.com', 'password123');

        const resRange = await agentInscrito.get(`/media/${assetId}`).set('Range', 'bytes=0-15');
        expect(resRange.statusCode).toBe(206);
        expect(resRange.headers['content-range']).toBe(`bytes 0-15/${mp4Bytes.length}`);
        expect(resRange.headers['content-length']).toBe('16');
        expect(resRange.body.length).toBe(16);

        // 2f. Impedir borrar el asset mientras la lección lo usa (409 Conflict)
        const resDeleteEnUso = await agentDocente
            .delete(`/curso/${curso.id}/media/${assetId}`)
            .set('Accept', 'application/json');
        expect(resDeleteEnUso.statusCode).toBe(409);
    });

    test('3. Progreso detallado: guarda el segundo exacto del video y el puntaje de quizzes intercalados y de módulo', async () => {
        const estudiante = await createTestUser({
            email: 'progreso.detallado@test.com',
            password: 'password123',
            rol: 'estudiante'
        });

        const curso = await Course.create({
            id: 'curso-interactivo',
            titulo: 'Curso Interactivo con Quizzes',
            descripcion: 'Verifica progreso de video y quizzes',
            categoria: 'datos'
        });

        const modulo = await contentService.crearModulo(curso, {
            titulo: 'Módulo con Quiz',
            quiz: [
                {
                    pregunta: '¿Qué estructura usa índices B-Tree por defecto en MongoDB?',
                    opciones: ['Colecciones estándar', 'Archivos de texto plano'],
                    respuestaCorrecta: 0
                }
            ]
        });

        const leccion = await contentService.crearLeccion(curso, modulo._id, {
            id: 'lec-interactiva-1',
            titulo: 'Índices Compuestos',
            bloques: [
                {
                    tipo: 'video',
                    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    duracionSeg: 600
                },
                {
                    tipo: 'quiz',
                    titulo: 'Quiz rápido a mitad de lección',
                    puntajeMinimo: 70,
                    preguntas: [
                        {
                            pregunta: '¿El orden de las llaves importa en un índice compuesto?',
                            opciones: ['Sí, sigue la regla de prefijos (ESR)', 'No, da igual el orden'],
                            respuestaCorrecta: 0
                        },
                        {
                            pregunta: '¿Qué comando inspecciona el plan de ejecución de una consulta?',
                            opciones: ['explain()', 'dropDatabase()'],
                            respuestaCorrecta: 0
                        }
                    ]
                }
            ]
        });

        const bloqueQuizId = leccion.bloques.find((b) => b.tipo === 'quiz')._id;

        await progressService.crearInscripcion(estudiante, curso);
        const agent = await loginAgent('progreso.detallado@test.com', 'password123');

        // 3a. Guardar segundo exacto del video (minuto 9:36 de 10:00 = 96% -> marca completado automático)
        const resVideo = await agent
            .post(`/curso/${curso.id}/leccion/${leccion.id}/video-progreso`)
            .set('Accept', 'application/json')
            .send({
                bloqueId: 'principal',
                segundoActual: 576,
                duracionSeg: 600
            });

        expect(resVideo.statusCode).toBe(200);
        expect(resVideo.body.progresoVideo.segundoActual).toBe(576);
        expect(resVideo.body.progresoVideo.completado).toBe(true);

        // 3b. Primer intento en el quiz intercalado de la lección (1 de 2 = 50%, reprobado)
        const resQuiz1 = await agent
            .post(`/curso/${curso.id}/leccion/${leccion.id}/bloque/${bloqueQuizId}/quiz/evaluar`)
            .set('Accept', 'application/json')
            .send({ respuestas: [0, 1] });

        expect(resQuiz1.statusCode).toBe(200);
        expect(resQuiz1.body.porcentaje).toBe(50);
        expect(resQuiz1.body.aprobado).toBe(false);
        expect(resQuiz1.body.intentos).toBe(1);

        // 3c. Segundo intento en el mismo quiz intercalado (2 de 2 = 100%, aprobado)
        const resQuiz2 = await agent
            .post(`/curso/${curso.id}/leccion/${leccion.id}/bloque/${bloqueQuizId}/quiz/evaluar`)
            .set('Accept', 'application/json')
            .send({ respuestas: [0, 0] });

        expect(resQuiz2.statusCode).toBe(200);
        expect(resQuiz2.body.porcentaje).toBe(100);
        expect(resQuiz2.body.mejorPuntaje).toBe(100);
        expect(resQuiz2.body.aprobado).toBe(true);
        expect(resQuiz2.body.intentos).toBe(2);

        // Verificar persistencia en Enrollment
        const inscripcionDb = await Enrollment.findOne({ estudiante: estudiante._id, cursoId: curso.id });
        expect(inscripcionDb.ultimaLeccionId).toBe(leccion.id);
        expect(inscripcionDb.progresoVideos).toHaveLength(1);
        expect(inscripcionDb.progresoQuizzes).toHaveLength(1);
        expect(inscripcionDb.progresoQuizzes[0].mejorPuntaje).toBe(100);
        expect(inscripcionDb.progresoQuizzes[0].intentos).toBe(2);
    });

    test('4. Migración v1 -> v2 es idempotente y preserva los slugs e inscripciones existentes', async () => {
        const moduloLegacyId = new mongoose.Types.ObjectId();
        const leccionLegacyId = new mongoose.Types.ObjectId();

        // Insertar documento en formato antiguo v1 directamente en la colección
        await Course.collection.insertOne({
            id: 'curso-legado-v1',
            titulo: 'Curso Legado V1',
            descripcion: 'Curso con array modulos embebido',
            categoria: 'web',
            nivel: 'Beginner',
            publicado: true,
            modulos: [
                {
                    _id: moduloLegacyId,
                    titulo: 'Módulo Legado 1',
                    orden: 1,
                    lecciones: [
                        {
                            _id: leccionLegacyId,
                            id: 'legado-1',
                            titulo: 'Lección Legada 1',
                            duracion: '20 min',
                            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                            explicacionDetallada: 'Explicación original en v1',
                            codigoEjemplo: 'console.log("v1");',
                            lenguajeCodigo: 'javascript',
                            orden: 1
                        }
                    ]
                }
            ]
        });

        const resumen1 = await migrarContenidoPendiente();
        expect(resumen1.cursos).toBe(1);
        expect(resumen1.modulos).toBe(1);
        expect(resumen1.lecciones).toBe(1);
        expect(resumen1.errores).toHaveLength(0);

        // Verificar que se crearon los documentos en Module y Lesson con sus mismos _id y slug
        const modDb = await Module.findById(moduloLegacyId);
        const lecDb = await Lesson.findById(leccionLegacyId);
        expect(modDb).not.toBeNull();
        expect(lecDb).not.toBeNull();
        expect(lecDb.id).toBe('legado-1');
        expect(lecDb.bloques).toHaveLength(3); // video + texto + codigo

        // Ejecutar por segunda vez: debe ser idempotente (0 cursos pendientes)
        const resumen2 = await migrarContenidoPendiente();
        expect(resumen2.cursos).toBe(0);
    });
});
