/**
 * @file playerController.js
 * @description Aula Virtual (Course Player), progreso de lecciones, proyectos y certificación.
 */

const crypto = require('crypto');
const Course = require('../../models/Course');
const User = require('../../models/User');
const StudentProject = require('../../models/StudentProject');
const progressService = require('../../services/progressService');
const logger = require('../../utils/logger');

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

        const inscripcion = await progressService.obtenerInscripcion(user._id, curso);
        if (!inscripcion) {
            req.flash('error_msg', 'Debes inscribirte en el curso antes de entrar al aula virtual.');
            return res.redirect(`/curso/${id}`);
        }

        const todasLasLecciones = progressService.obtenerLecciones(curso);
        const leccionesCompletadas = progressService.normalizarCompletadas(curso, inscripcion.leccionesCompletadas);

        let leccionActiva = null;
        if (leccionId) {
            leccionActiva = todasLasLecciones.find(
                (l) => String(l.id) === String(leccionId) || String(l._id) === String(leccionId)
            );
        }
        if (!leccionActiva && todasLasLecciones.length > 0) {
            const primeraIncompleta = todasLasLecciones.find(
                (l) => !leccionesCompletadas.includes(progressService.claveLeccion(l))
            );
            leccionActiva = primeraIncompleta || todasLasLecciones[0];
        }

        let leccionAnterior = null;
        let leccionSiguiente = null;
        if (leccionActiva) {
            const index = todasLasLecciones.findIndex(
                (l) => progressService.claveLeccion(l) === progressService.claveLeccion(leccionActiva)
            );
            if (index > 0) leccionAnterior = todasLasLecciones[index - 1];
            if (index < todasLasLecciones.length - 1) leccionSiguiente = todasLasLecciones[index + 1];
        }

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
        logger.error({ err }, 'Error al abrir Aula Virtual');
        req.flash('error_msg', 'No se pudo abrir el aula virtual.');
        res.redirect('/panel');
    }
};

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

        const leccion = lecciones.find(
            (l) => String(l.id) === String(leccionId) || String(l._id) === String(leccionId)
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
        const nuevas = yaCompletada ? completadas.filter((c) => c !== clave) : [...completadas, clave];

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
        logger.error({ err }, 'Error al completar lección');
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(500).json({ success: false, msg: 'Error al actualizar progreso' });
        }
        res.redirect(`/curso/${id}/aula`);
    }
};

exports.postCompletarProgreso = exports.postCompletarLeccion;

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

        let estadoPermitido = estado === 'En Revisión' ? 'En Revisión' : 'En Progreso';
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
        logger.error({ err }, 'Error al guardar proyecto práctico');
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(500).json({ success: false, msg: 'Error al guardar avance' });
        }
        req.flash('error_msg', 'Error al guardar el proyecto.');
        res.redirect(`/curso/${id}/aula`);
    }
};

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

        const leccionesAl100 = progressService.estaCompleto(curso, inscripcion.leccionesCompletadas);

        const proyecto = await StudentProject.findOne({
            estudiante: user._id,
            cursoId: id,
            estado: 'Completado'
        });

        if (!leccionesAl100 || !proyecto) {
            req.flash(
                'error_msg',
                'Para obtener tu certificación oficial debes completar el 100% de las lecciones del curso y tener tu proyecto práctico aprobado por el docente.'
            );
            return res.redirect(`/curso/${id}/aula`);
        }

        const hashCertificado = crypto
            .createHash('sha256')
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
        logger.error({ err }, 'Error al generar certificado');
        req.flash('error_msg', 'Error al procesar la certificación.');
        res.redirect(`/curso/${req.params.id}/aula`);
    }
};

exports.postEvaluarQuiz = async (req, res) => {
    try {
        const { id, moduloId } = req.params;
        const { respuestas } = req.body;

        const curso = await Course.findOne({ id });
        if (!curso || !Array.isArray(curso.modulos) || curso.modulos.length === 0) {
            return res.status(404).json({ success: false, msg: 'Módulo no encontrado.' });
        }

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
                        'Estructurar código limpio y modular con separación de responsabilidades',
                        'Escribir todo el código en un único archivo global',
                        'Evitar el uso de pruebas y validaciones'
                    ],
                    respuestaCorrecta: 0,
                    explicacion: 'La modularidad y desacoplamiento son indispensables para la escalabilidad.'
                },
                {
                    pregunta: '¿Cuál es la mejor práctica de persistencia y estado en arquitecturas web?',
                    opciones: [
                        'Almacenar sesiones volátiles en memoria sin réplica',
                        'Persistir sesiones de forma distribuida e índices optimizados',
                        'Ignorar los índices de base de datos'
                    ],
                    respuestaCorrecta: 1,
                    explicacion: 'La persistencia distribuida garantiza resiliencia y alta concurrencia.'
                },
                {
                    pregunta: '¿Qué mecanismo protege eficazmente contra ataques de inyección y XSS?',
                    opciones: [
                        'Confiar plenamente en los datos provenientes del cliente',
                        'Desactivar CSP y cabeceras de seguridad',
                        'Sanitizar entradas, validar esquemas y escapar salidas en plantillas'
                    ],
                    respuestaCorrecta: 2,
                    explicacion:
                        'La defensa en profundidad exige validación estricta y sanitización de entrada y salida.'
                }
            ];
        }

        let correctas = 0;
        const total = quizPreguntas.length;
        const detalles = [];

        quizPreguntas.forEach((item, index) => {
            const respUsuario = respuestas ? parseInt(respuestas[index], 10) : -1;
            const esCorrecta = respUsuario === item.respuestaCorrecta;
            if (esCorrecta) correctas++;
            detalles.push({
                preguntaIndex: index,
                esCorrecta,
                explicacion: item.explicacion || ''
            });
        });

        const porcentaje = Math.round((correctas / total) * 100);
        const aprobado = porcentaje >= 70;

        return res.json({
            success: true,
            porcentaje,
            aprobado,
            mensaje: aprobado
                ? `¡Excelente! Aprobaste el cuestionario con ${correctas} de ${total} respuestas correctas (${porcentaje}%).`
                : `Obtuviste ${correctas} de ${total} correctas (${porcentaje}%). Te recomendamos repasar los temas del módulo y reintentar.`,
            detalles
        });
    } catch (err) {
        logger.error({ err }, 'Error al evaluar quiz');
        return res.status(500).json({ success: false, msg: 'Error interno al evaluar el cuestionario.' });
    }
};
