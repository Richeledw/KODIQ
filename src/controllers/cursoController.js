/**
 * @file cursoController.js
 * @description Controlador para gestionar el catálogo de cursos, inscripción de estudiantes,
 * Aula Virtual (Course Player con video, teoría y recursos) y el Espacio de Trabajo de Proyectos Prácticos.
 */

const Course = require('../models/Course');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const StudentProject = require('../models/StudentProject');
const staticCursos = require('../models/cursosData');
const progressService = require('../services/progressService');
const crypto = require('crypto');

/**
 * @route GET /temas
 * @description Renderiza el catálogo completo de cursos activos en la plataforma.
 */
exports.getTemas = async (req, res) => {
    try {
        let cursos = await Course.find({ publicado: true }).sort({ creadoEn: -1 });

        // Si la base de datos no tiene cursos aún, recurrir a los estáticos
        if (!cursos || cursos.length === 0) {
            cursos = Object.values(staticCursos);
        }

        // Obtener IDs de cursos en los que el usuario ya está inscrito (si está logueado)
        let inscritosIds = [];
        if (req.user) {
            const inscripciones = await Enrollment.find({ estudiante: req.user.id }).select('cursoId');
            inscritosIds = inscripciones.map(i => i.cursoId);
        }

        res.render('temas', {
            datosTemas: {
                titulo: 'Nuestros Cursos',
                descripcion: 'Explora nuestra amplia variedad de cursos prácticos y certificados',
                cursos: cursos,
                inscritosIds: inscritosIds
            }
        });
    } catch (err) {
        console.error('Error al obtener catálogo de cursos:', err);
        res.status(500).render('error', {
            mensaje: 'Error del servidor',
            descripcion: 'No se pudieron cargar los cursos en este momento.'
        });
    }
};

/**
 * @route GET /curso/:id
 * @description Muestra la página de presentación detallada de un curso (temario, requisitos, botón de inscripción).
 */
exports.getCurso = async (req, res) => {
    const { id } = req.params;

    try {
        let curso = await Course.findOne({ id });

        // Si no está en BD, buscar en estáticos
        if (!curso && staticCursos[id]) {
            curso = { id, ...staticCursos[id], modulos: [], recursosGlobales: [] };
        }

        if (!curso) {
            return res.status(404).render('error', {
                mensaje: 'Curso no encontrado',
                descripcion: 'El curso que buscas no existe o ha sido retirado.'
            });
        }

        // Cursos relacionados de la misma categoría
        const cursosRelacionados = await Course.find({
            categoria: curso.categoria,
            id: { $ne: id }
        }).limit(3);

        // Verificar si el usuario actual está inscrito
        let estaInscrito = false;
        let progresoInscripcion = 0;

        if (req.user) {
            const inscripcion = await progressService.obtenerInscripcion(req.user.id, curso);
            if (inscripcion) {
                estaInscrito = true;
                progresoInscripcion = inscripcion.progreso || 0;
            }
        }

        res.render('curso', {
            datosCurso: {
                ...curso.toObject ? curso.toObject() : curso,
                cursos_relacionados: cursosRelacionados,
                estaInscrito,
                progresoInscripcion
            }
        });
    } catch (err) {
        console.error('Error al obtener curso:', err);
        res.status(500).render('error', {
            mensaje: 'Error al cargar el curso',
            descripcion: 'Ocurrió un error inesperado al consultar los datos del curso.'
        });
    }
};

/**
 * @route POST /curso/:id/inscribir
 * @description Inscribe al estudiante autenticado en el curso y desbloquea el Aula Virtual.
 */
exports.postInscribir = async (req, res) => {
    if (!req.isAuthenticated()) {
        req.flash('error_msg', 'Debes iniciar sesión para inscribirte a un curso.');
        return res.redirect(`/login`);
    }

    const { id } = req.params;

    try {
        const curso = await Course.findOne({ id });
        if (!curso) {
            req.flash('error_msg', 'El curso seleccionado no existe.');
            return res.redirect('/temas');
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/login');
        }

        // `obtenerInscripcion` migra de forma perezosa el registro legado si existe.
        const inscripcionPrevia = await progressService.obtenerInscripcion(user._id, curso);

        if (!inscripcionPrevia) {
            // Inscripción explícita: Enrollment es la fuente de verdad y se
            // mantiene el espejo legado en User.cursosInscritos.
            await progressService.crearInscripcion(user, curso);

            // Inicializar el espacio del proyecto práctico del estudiante para este curso
            const proyectoExistente = await StudentProject.findOne({ estudiante: user._id, cursoId: id });
            if (!proyectoExistente) {
                await StudentProject.create({
                    estudiante: user._id,
                    estudianteNombre: user.nombre,
                    estudianteEmail: user.email,
                    cursoId: id,
                    cursoTitulo: curso.titulo,
                    titulo: `Proyecto: ${curso.proyectoConsigna?.titulo || curso.titulo}`,
                    descripcion: '',
                    notasAvance: '',
                    estado: 'En Progreso'
                });
            }

            req.flash('success_msg', `¡Felicitaciones! Te has inscrito exitosamente en "${curso.titulo}".`);
        } else {
            req.flash('success_msg', `Ya estás inscrito en "${curso.titulo}". ¡Continuemos aprendiendo!`);
        }

        // Redirigir directamente al Aula Virtual
        return res.redirect(`/curso/${id}/aula`);

    } catch (err) {
        console.error('Error al procesar inscripción:', err);
        req.flash('error_msg', 'Ocurrió un error al procesar tu matrícula.');
        res.redirect(`/curso/${id}`);
    }
};

/**
 * @route GET /curso/:id/aula
 * @route GET /curso/:id/aula/:leccionId
 * @description Vista del Aula Virtual (Course Player): Reproductor de Video, Explicación teórica,
 * recursos descargables, navegación de lecciones y espacio de proyecto práctico.
 */
exports.getAulaVirtual = async (req, res) => {
    const { id, leccionId } = req.params;

    try {
        const curso = await Course.findOne({ id });
        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/temas');
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/login');
        }

        // Inscripción explícita: el aula no crea matrículas por su cuenta.
        const inscripcion = await progressService.obtenerInscripcion(user._id, curso);
        if (!inscripcion) {
            req.flash('error_msg', 'Debes inscribirte en el curso antes de entrar al aula virtual.');
            return res.redirect(`/curso/${id}`);
        }

        // Aplanar todas las lecciones con su módulo para navegación secuencial.
        const todasLasLecciones = progressService.obtenerLecciones(curso);
        const leccionesCompletadas = progressService.normalizarCompletadas(
            curso,
            inscripcion.leccionesCompletadas
        );

        // Determinar la lección activa (acepta slug `id` o `_id`).
        let leccionActiva = null;
        if (leccionId) {
            leccionActiva = todasLasLecciones.find((l) =>
                String(l.id) === String(leccionId) || String(l._id) === String(leccionId)
            );
        }
        if (!leccionActiva && todasLasLecciones.length > 0) {
            // Por defecto, la primera lección no completada, o la primera del curso
            const primeraIncompleta = todasLasLecciones.find(
                (l) => !leccionesCompletadas.includes(progressService.claveLeccion(l))
            );
            leccionActiva = primeraIncompleta || todasLasLecciones[0];
        }

        // Calcular índices de lección anterior y siguiente
        let leccionAnterior = null;
        let leccionSiguiente = null;
        if (leccionActiva) {
            const index = todasLasLecciones.findIndex(
                (l) => progressService.claveLeccion(l) === progressService.claveLeccion(leccionActiva)
            );
            if (index > 0) leccionAnterior = todasLasLecciones[index - 1];
            if (index < todasLasLecciones.length - 1) leccionSiguiente = todasLasLecciones[index + 1];
        }

        // Obtener el proyecto práctico del estudiante para este curso
        let proyecto = await StudentProject.findOne({ estudiante: user._id, cursoId: id });
        if (!proyecto) {
            proyecto = await StudentProject.create({
                estudiante: user._id,
                estudianteNombre: user.nombre,
                estudianteEmail: user.email,
                cursoId: id,
                cursoTitulo: curso.titulo,
                titulo: `Proyecto: ${curso.proyectoConsigna?.titulo || curso.titulo}`,
                descripcion: '',
                notasAvance: '',
                estado: 'En Progreso'
            });
        }

        // Porcentaje real calculado solo con lecciones existentes.
        const porcentajeProgreso = progressService.calcularProgreso(
            todasLasLecciones.length,
            leccionesCompletadas.length
        );

        res.render('aula', {
            titlePage: `Aula Virtual - ${curso.titulo}`,
            curso,
            todasLasLecciones,
            leccionActiva,
            leccionAnterior,
            leccionSiguiente,
            leccionesCompletadas,
            porcentajeProgreso,
            proyecto
        });

    } catch (err) {
        console.error('Error al abrir Aula Virtual:', err);
        req.flash('error_msg', 'No se pudo abrir el aula virtual.');
        res.redirect('/panel');
    }
};

/**
 * @route POST /curso/:id/leccion/:leccionId/completar
 * @description Marca o desmarca una lección como completada y actualiza el progreso en BD.
 */
exports.postCompletarLeccion = async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, msg: 'No autorizado' });
    }

    const { id, leccionId } = req.params;
    const esperaJson = Boolean(req.xhr || req.headers.accept?.includes('json'));

    try {
        const curso = await Course.findOne({ id });
        if (!curso) {
            if (esperaJson) return res.status(404).json({ success: false, msg: 'Curso no encontrado' });
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/temas');
        }

        const lecciones = progressService.obtenerLecciones(curso);
        if (lecciones.length === 0) {
            if (esperaJson) return res.status(400).json({ success: false, msg: 'El curso no tiene lecciones' });
            req.flash('error_msg', 'Este curso todavía no tiene lecciones.');
            return res.redirect(`/curso/${id}`);
        }

        // Validar que la lección exista (acepta slug `id` o `_id`).
        const leccion = lecciones.find((l) =>
            String(l.id) === String(leccionId) || String(l._id) === String(leccionId)
        );
        if (!leccion) {
            if (esperaJson) return res.status(404).json({ success: false, msg: 'Lección no encontrada' });
            req.flash('error_msg', 'La lección indicada no existe en este curso.');
            return res.redirect(`/curso/${id}/aula`);
        }

        const clave = progressService.claveLeccion(leccion);
        const inscripcion = await progressService.obtenerInscripcion(req.user.id, curso);
        if (!inscripcion) {
            if (esperaJson) return res.status(403).json({ success: false, msg: 'No estás inscrito en este curso' });
            req.flash('error_msg', 'Debes inscribirte en el curso antes de registrar progreso.');
            return res.redirect(`/curso/${id}`);
        }

        const completadas = progressService.normalizarCompletadas(curso, inscripcion.leccionesCompletadas);
        const yaCompletada = completadas.includes(clave);
        const nuevas = yaCompletada
            ? completadas.filter((c) => c !== clave)
            : [...completadas, clave];

        const resultado = await progressService.guardarProgreso(req.user.id, curso, nuevas);

        if (esperaJson) {
            return res.json({
                success: true,
                completada: !yaCompletada,
                progreso: resultado.progreso,
                leccionesCompletadasCount: resultado.completadas.length,
                totalLecciones: resultado.total
            });
        }

        req.flash('success_msg', yaCompletada ? 'Lección desmarcada.' : '¡Lección completada!');
        res.redirect(`/curso/${id}/aula/${clave}`);

    } catch (err) {
        console.error('Error al completar lección:', err);
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(500).json({ success: false, msg: 'Error al actualizar progreso' });
        }
        res.redirect(`/curso/${id}/aula`);
    }
};

/**
 * @route POST /curso/:id/proyecto/guardar
 * @description Guarda el avance, notas y entregables del proyecto del estudiante para el curso.
 */
exports.postGuardarProyecto = async (req, res) => {
    if (!req.isAuthenticated()) {
        req.flash('error_msg', 'Debes iniciar sesión para guardar tu proyecto.');
        return res.redirect('/login');
    }

    const { id } = req.params;
    const { titulo, descripcion, notasAvance, repositorioUrl, despliegueUrl, videoDemoUrl, estado } = req.body;

    try {
        const user = req.user;
        const curso = await Course.findOne({ id });
        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/temas');
        }

        const inscripcion = await progressService.obtenerInscripcion(user._id, curso);
        if (!inscripcion) {
            req.flash('error_msg', 'Debes inscribirte en el curso antes de guardar un proyecto.');
            return res.redirect(`/curso/${id}`);
        }

        const proyectoExistente = await StudentProject.findOne({ estudiante: user._id, cursoId: id });

        // Blindaje RBAC: el estudiante solo puede marcar 'En Progreso' o
        // 'En Revisión'. Un proyecto ya aprobado no puede volver atrás.
        let estadoPermitido = (estado === 'En Revisión') ? 'En Revisión' : 'En Progreso';
        if (proyectoExistente && proyectoExistente.estado === 'Completado') {
            estadoPermitido = 'Completado';
        }

        const proyecto = await StudentProject.findOneAndUpdate(
            { estudiante: user._id, cursoId: id },
            {
                estudiante: user._id,
                estudianteNombre: user.nombre,
                estudianteEmail: user.email,
                cursoId: id,
                cursoTitulo: curso.titulo,
                titulo: titulo || (proyectoExistente && proyectoExistente.titulo) || 'Mi Proyecto Práctico',
                descripcion: descripcion || '',
                notasAvance: notasAvance || '',
                repositorioUrl: repositorioUrl || '',
                despliegueUrl: despliegueUrl || '',
                videoDemoUrl: videoDemoUrl || '',
                estado: estadoPermitido,
                actualizadoEn: new Date()
            },
            { upsert: true, new: true }
        );

        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.json({
                success: true,
                msg: '¡Avance del proyecto guardado exitosamente!',
                proyecto
            });
        }

        req.flash('success_msg', '¡Tu avance y entregables del proyecto se han guardado exitosamente!');
        res.redirect(`/curso/${id}/aula#pills-proyecto`);

    } catch (err) {
        console.error('Error al guardar proyecto práctico:', err);
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(500).json({ success: false, msg: 'Error al guardar avance' });
        }
        req.flash('error_msg', 'Error al guardar el proyecto.');
        res.redirect(`/curso/${id}/aula`);
    }
};

/**
 * @route POST /api/progreso/completar
 * @description Compatibilidad hacia atrás con endpoints anteriores
 */
exports.postCompletarProgreso = exports.postCompletarLeccion;

/**
 * @route GET /curso/:id/certificado
 * @description Genera y renderiza el certificado de finalización si el estudiante cumplió el 100% de lecciones y tiene el proyecto aprobado.
 */
exports.getCertificado = async (req, res) => {
    try {
        const { id } = req.params;
        const curso = await Course.findOne({ id });

        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/panel');
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/login');
        }

        const inscripcion = await progressService.obtenerInscripcion(user._id, curso);
        if (!inscripcion) {
            req.flash('error_msg', 'No estás inscrito en este curso.');
            return res.redirect(`/curso/${id}`);
        }

        // 1. Validar el 100 % real: todas las lecciones existentes deben estar
        // completadas. No se confía en el campo `progreso` ni en IDs antiguos.
        const leccionesAl100 = progressService.estaCompleto(
            curso,
            inscripcion.leccionesCompletadas
        );

        // 2. Validar que el proyecto práctico esté evaluado y aprobado por docente o admin
        const proyecto = await StudentProject.findOne({
            estudiante: user._id,
            cursoId: id,
            estado: 'Completado'
        });

        if (!leccionesAl100 || !proyecto) {
            req.flash('error_msg', 'Para obtener tu certificación oficial debes completar el 100% de las lecciones del curso y tener tu proyecto práctico aprobado por el docente.');
            return res.redirect(`/curso/${id}/aula`);
        }

        // Generar hash único de certificación
        const hashCertificado = crypto.createHash('sha256')
            .update(`${user._id}-${id}-eduplat-verified-cert`)
            .digest('hex')
            .substring(0, 12)
            .toUpperCase();

        res.render('certificado', {
            user,
            curso,
            proyecto,
            hashCertificado
        });

    } catch (err) {
        console.error('Error al generar certificado:', err);
        req.flash('error_msg', 'Error al procesar la certificación.');
        res.redirect(`/curso/${req.params.id}/aula`);
    }
};

/**
 * @route POST /curso/:id/modulo/:moduloId/quiz/evaluar
 * @description Evalúa interactivamente las respuestas del cuestionario de un módulo y devuelve retroalimentación inmediata.
 */
exports.postEvaluarQuiz = async (req, res) => {
    try {
        const { id, moduloId } = req.params;
        const { respuestas } = req.body;

        const curso = await Course.findOne({ id });
        if (!curso || !Array.isArray(curso.modulos) || curso.modulos.length === 0) {
            return res.status(404).json({ success: false, msg: 'Módulo no encontrado.' });
        }

        // Acepta `_id` del módulo y, por compatibilidad, el índice numérico.
        let modulo = curso.modulos.find((m) => String(m._id) === String(moduloId));
        if (!modulo && /^\d+$/.test(String(moduloId))) {
            modulo = curso.modulos[Number(moduloId)];
        }
        if (!modulo) {
            return res.status(404).json({ success: false, msg: 'Módulo no encontrado.' });
        }

        let quizPreguntas = modulo.quiz;

        if (!quizPreguntas || quizPreguntas.length === 0) {
            quizPreguntas = [
                {
                    pregunta: `¿Cuál es el principio fundamental abordado en "${modulo.titulo}"?`,
                    opciones: [
                        'Estructurar código limpio y modular siguiendo estándares de la industria',
                        'Ignorar los estándares y utilizar configuraciones por defecto sin validar',
                        'Escribir toda la lógica en un solo archivo sin separación de conceptos',
                        'Desactivar las validaciones para acelerar el desarrollo'
                    ],
                    respuestaCorrecta: 0,
                    explicacion: 'La modularidad y la separación de responsabilidades son esenciales para la mantenibilidad y escalabilidad del software.'
                },
                {
                    pregunta: '¿Por qué es indispensable validar los datos de entrada antes de persistirlos en la base de datos?',
                    opciones: [
                        'Para evitar errores de ejecución, inyecciones de datos y asegurar consistencia',
                        'Únicamente por motivos estéticos en la interfaz de usuario',
                        'No es necesario si la base de datos es NoSQL',
                        'Solo se requiere si el servidor tiene poco almacenamiento'
                    ],
                    respuestaCorrecta: 0,
                    explicacion: 'Validar entradas sanitiza las peticiones y previene inconsistencias o vulnerabilidades de seguridad.'
                },
                {
                    pregunta: '¿Cuál es la mejor práctica recomendada al estructurar proyectos web profesionales?',
                    opciones: [
                        'Seguir una arquitectura en capas (rutas, controladores, modelos y middlewares)',
                        'Colocar toda la lógica de negocio dentro de las vistas EJS',
                        'No usar variables de entorno para las credenciales',
                        'Evitar el control de versiones en git'
                    ],
                    respuestaCorrecta: 0,
                    explicacion: 'Una arquitectura desacoplada (como MVC) facilita el testing, la refactorización y el trabajo en equipo.'
                }
            ];
        }

        let aciertos = 0;
        const total = quizPreguntas.length;
        const detalles = [];

        quizPreguntas.forEach((q, idx) => {
            const respuestaUsuario = respuestas ? Number(respuestas[idx]) : -1;
            const esCorrecta = respuestaUsuario === q.respuestaCorrecta;
            if (esCorrecta) aciertos++;

            detalles.push({
                pregunta: q.pregunta,
                opcionSeleccionada: respuestaUsuario,
                esCorrecta,
                respuestaCorrecta: q.respuestaCorrecta,
                explicacion: q.explicacion
            });
        });

        const porcentaje = Math.round((aciertos / total) * 100);
        const aprobado = porcentaje >= 70;

        return res.json({
            success: true,
            total,
            aciertos,
            porcentaje,
            aprobado,
            detalles,
            mensaje: aprobado 
                ? `¡Felicitaciones! Has aprobado el cuestionario con ${porcentaje}% (${aciertos}/${total}).`
                : `Has obtenido ${porcentaje}% (${aciertos}/${total}). Revisa las explicaciones e inténtalo de nuevo para afianzar el aprendizaje.`
        });

    } catch (err) {
        console.error('Error al evaluar quiz:', err);
        return res.status(500).json({ success: false, msg: 'Error al evaluar cuestionario.' });
    }
};
