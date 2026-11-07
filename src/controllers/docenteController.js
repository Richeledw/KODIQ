/**
 * @file docenteController.js
 * @description Controlador exclusivo para el Panel de Docente (Rol: docente / teacher).
 * Permite a los instructores crear y editar sus cursos propios, estructurar módulos y lecciones
 * con videos y explicaciones, adjuntar recursos y evaluar proyectos prácticos de sus alumnos.
 */

const Course = require('../models/Course');
const User = require('../models/User');
const StudentProject = require('../models/StudentProject');
const Enrollment = require('../models/Enrollment');

/**
 * @route GET /docente/dashboard
 * @description Panel principal del docente con métricas de sus cursos, alumnos inscritos y proyectos pendientes.
 */
exports.getDashboard = async (req, res) => {
    try {
        const userId = req.user._id;

        // Admin ve todo; docente solo los cursos de los que es autor.
        // No se usa `autorNombre` (dos docentes pueden llamarse igual) ni se
        // muestran cursos ajenos cuando el docente aún no tiene cursos.
        const filtro = req.user.rol === 'admin' ? {} : { autor: userId };
        const misCursos = await Course.find(filtro).sort({ creadoEn: -1 });

        const cursoIds = misCursos.map(c => c.id);

        const [totalEstudiantesInscritos, totalProyectosPendientes] = await Promise.all([
            Enrollment.countDocuments({ cursoId: { $in: cursoIds } }),
            StudentProject.countDocuments({ cursoId: { $in: cursoIds }, estado: 'En Revisión' })
        ]);

        res.render('docente/dashboard', {
            titlePage: 'Panel de Docente',
            user: req.user,
            totalCursosPropios: misCursos.length,
            totalEstudiantesInscritos,
            totalProyectosPendientes,
            listaCursos: misCursos
        });
    } catch (err) {
        console.error('Error en dashboard de docente:', err);
        res.status(500).send('Error interno del servidor');
    }
};

/**
 * @route GET /docente/cursos/nuevo
 * @description Formulario para que el docente publique un nuevo curso.
 */
exports.getNuevoCurso = (req, res) => {
    res.render('docente/curso-form', {
        titlePage: 'Crear Nuevo Curso',
        curso: null,
        esEdicion: false
    });
};

/**
 * @route POST /docente/cursos/crear
 * @description Procesa la publicación de un nuevo curso creado por el docente.
 */
exports.crearCurso = async (req, res) => {
    try {
        const { id, titulo, descripcion, descripcionLarga, categoria, nivel, duracion, icono, color, proyectoTitulo, proyectoDescripcion } = req.body;

        const cursoIdSlug = (id || titulo).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

        const cursoExistente = await Course.findOne({ id: cursoIdSlug });
        if (cursoExistente) {
            req.flash('error_msg', `Ya existe un curso con el identificador "${cursoIdSlug}".`);
            return res.redirect('/docente/cursos/nuevo');
        }

        const nuevoCurso = await Course.create({
            id: cursoIdSlug,
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            descripcionLarga: descripcionLarga ? descripcionLarga.trim() : '',
            categoria: categoria || 'web',
            nivel: nivel || 'Beginner',
            duracion: duracion || '10 horas',
            icono: icono || '/img/html5.svg',
            color: color || 'success',
            autor: req.user._id,
            autorNombre: req.user.nombre,
            publicado: true,
            proyectoConsigna: {
                titulo: proyectoTitulo || 'Proyecto Final del Curso',
                descripcion: proyectoDescripcion || 'Aplica los conceptos impartidos en el curso construyendo una solución práctica.',
                requisitos: ['Estructura limpia', 'Documentación clara', 'Código funcional']
            },
            modulos: [
                {
                    titulo: 'Módulo 1: Introducción y Primeros Pasos',
                    descripcion: 'Comenzando con la materia.',
                    orden: 1,
                    lecciones: [
                        {
                            id: `${cursoIdSlug}-1`,
                            titulo: 'Bienvenida al Curso y Objetivos',
                            duracion: '10 min',
                            videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                            explicacionDetallada: 'Bienvenido. En esta lección inicial repasaremos las metas y requisitos del curso.',
                            orden: 1
                        }
                    ]
                }
            ]
        });

        req.flash('success_msg', `¡Curso "${nuevoCurso.titulo}" creado exitosamente! Ahora puedes estructurar sus lecciones.`);
        res.redirect(`/docente/cursos/${nuevoCurso.id}/contenido`);
    } catch (err) {
        console.error('Error al crear curso docente:', err);
        req.flash('error_msg', 'Error al crear curso: ' + err.message);
        res.redirect('/docente/cursos/nuevo');
    }
};

/**
 * @route GET /docente/cursos/:id/editar
 * @description Formulario para editar un curso propio del docente.
 */
exports.getEditarCurso = async (req, res) => {
    try {
        const { id } = req.params;
        const curso = await Course.findOne({ id });

        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/docente/dashboard');
        }

        // Validar que el curso pertenezca a este docente (o sea admin)
        if (req.user.rol !== 'admin' && curso.autor && curso.autor.toString() !== req.user._id.toString()) {
            req.flash('error_msg', 'Solo puedes editar cursos creados por ti.');
            return res.redirect('/docente/dashboard');
        }

        res.render('docente/curso-form', {
            titlePage: `Editar Curso: ${curso.titulo}`,
            curso,
            esEdicion: true
        });
    } catch (err) {
        console.error('Error al cargar edición de curso:', err);
        res.status(500).send('Error interno del servidor');
    }
};

/**
 * @route POST /docente/cursos/:id/editar
 * @description Guardar cambios en un curso propio del docente.
 */
exports.editarCurso = async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, descripcion, descripcionLarga, categoria, nivel, duracion, icono, color, proyectoTitulo, proyectoDescripcion } = req.body;

        const curso = await Course.findOne({ id });
        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/docente/dashboard');
        }

        if (req.user.rol !== 'admin' && curso.autor && curso.autor.toString() !== req.user._id.toString()) {
            req.flash('error_msg', 'Solo puedes editar cursos creados por ti.');
            return res.redirect('/docente/dashboard');
        }

        curso.titulo = titulo.trim();
        curso.descripcion = descripcion.trim();
        curso.descripcionLarga = descripcionLarga ? descripcionLarga.trim() : '';
        curso.categoria = categoria || curso.categoria;
        curso.nivel = nivel || curso.nivel;
        curso.duracion = duracion || curso.duracion;
        curso.icono = icono || curso.icono;
        curso.color = color || curso.color;
        if (proyectoTitulo) curso.proyectoConsigna.titulo = proyectoTitulo.trim();
        if (proyectoDescripcion) curso.proyectoConsigna.descripcion = proyectoDescripcion.trim();

        await curso.save();

        req.flash('success_msg', 'Curso actualizado exitosamente.');
        res.redirect('/docente/dashboard');
    } catch (err) {
        console.error('Error al actualizar curso:', err);
        req.flash('error_msg', 'Error al guardar cambios.');
        res.redirect('/docente/dashboard');
    }
};

/**
 * @route POST /docente/cursos/:id/eliminar
 * @description Elimina un curso creado por el docente autenticado.
 */
exports.eliminarCurso = async (req, res) => {
    try {
        const { id } = req.params;
        const cleanId = (id || '').trim();

        const curso = await Course.findOne({ id: cleanId });
        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado o ya fue eliminado.');
            return res.redirect('/docente/dashboard');
        }

        // Validar propiedad del curso (si no es admin)
        if (req.user.rol !== 'admin' && curso.autor && curso.autor.toString() !== req.user._id.toString()) {
            req.flash('error_msg', 'Solo puedes eliminar cursos creados por ti.');
            return res.redirect('/docente/dashboard');
        }

        await Course.findOneAndDelete({ id: cleanId });
        await Enrollment.deleteMany({ cursoId: cleanId });
        await StudentProject.deleteMany({ cursoId: cleanId });
        // Limpiar el espejo legado para que no queden referencias al curso eliminado.
        await User.updateMany(
            { cursosInscritos: cleanId },
            { $pull: { cursosInscritos: cleanId } }
        );

        req.flash('success_msg', `Curso "${curso.titulo}" eliminado exitosamente.`);
        res.redirect('/docente/dashboard');
    } catch (err) {
        console.error('Error al eliminar curso docente:', err);
        req.flash('error_msg', 'Error al eliminar el curso: ' + err.message);
        res.redirect('/docente/dashboard');
    }
};

/**
 * @route GET /docente/cursos/:id/contenido
 * @description Constructor de contenido (módulos, lecciones, videos, explicaciones y recursos).
 */
exports.getContenidoCurso = async (req, res) => {
    try {
        const { id } = req.params;
        const curso = await Course.findOne({ id });

        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/docente/dashboard');
        }

        res.render('docente/contenido', {
            titlePage: `Constructor de Contenido: ${curso.titulo}`,
            curso
        });
    } catch (err) {
        console.error('Error al cargar contenido de curso para docente:', err);
        res.status(500).send('Error interno del servidor');
    }
};

/**
 * @route POST /docente/cursos/:id/modulo/crear
 * @description Agregar un módulo al curso.
 */
exports.crearModulo = async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, descripcion } = req.body;

        const curso = await Course.findOne({ id });
        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/docente/dashboard');
        }

        const orden = (curso.modulos ? curso.modulos.length : 0) + 1;
        curso.modulos.push({
            titulo: titulo.trim(),
            descripcion: descripcion ? descripcion.trim() : '',
            orden,
            lecciones: []
        });

        await curso.save();
        req.flash('success_msg', `Módulo "${titulo}" agregado.`);
        res.redirect(`/docente/cursos/${id}/contenido`);
    } catch (err) {
        console.error('Error al crear módulo docente:', err);
        req.flash('error_msg', 'Error al crear módulo.');
        res.redirect(`/docente/cursos/${req.params.id}/contenido`);
    }
};

/**
 * @route POST /docente/cursos/:id/modulo/:moduloId/leccion/crear
 * @description Agregar lección con URL de video, explicación extendida y recursos.
 */
exports.crearLeccion = async (req, res) => {
    try {
        const { id, moduloId } = req.params;
        const { titulo, duracion, videoUrl, explicacionDetallada, codigoEjemplo, lenguajeCodigo } = req.body;

        const curso = await Course.findOne({ id });
        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/docente/dashboard');
        }

        // Busca por `_id` del submódulo y, por compatibilidad, por índice numérico.
        let modulo = curso.modulos.find((m) => String(m._id) === String(moduloId));
        if (!modulo && /^\d+$/.test(String(moduloId))) {
            modulo = curso.modulos[Number(moduloId)];
        }
        if (!modulo) {
            req.flash('error_msg', 'Módulo no encontrado.');
            return res.redirect(`/docente/cursos/${id}/contenido`);
        }
        const leccionId = `${id}-${Date.now().toString().slice(-4)}`;

        modulo.lecciones.push({
            id: leccionId,
            titulo: titulo.trim(),
            duracion: duracion || '15 min',
            videoUrl: videoUrl || 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            explicacionDetallada: explicacionDetallada || '',
            codigoEjemplo: codigoEjemplo || '',
            lenguajeCodigo: lenguajeCodigo || 'javascript',
            recursos: [],
            orden: (modulo.lecciones ? modulo.lecciones.length : 0) + 1
        });

        await curso.save();
        req.flash('success_msg', `Lección "${titulo}" añadida exitosamente.`);
        res.redirect(`/docente/cursos/${id}/contenido`);
    } catch (err) {
        console.error('Error al crear lección docente:', err);
        req.flash('error_msg', 'Error al añadir lección.');
        res.redirect(`/docente/cursos/${req.params.id}/contenido`);
    }
};

/**
 * @route POST /docente/cursos/:id/modulo/:moduloId/leccion/:leccionId/eliminar
 * @description Eliminar una lección de un módulo.
 */
exports.eliminarLeccion = async (req, res) => {
    try {
        const { id, moduloId, leccionId } = req.params;
        const curso = await Course.findOne({ id });

        if (curso) {
            let modulo = curso.modulos.find((m) => String(m._id) === String(moduloId));
            if (!modulo && /^\d+$/.test(String(moduloId))) {
                modulo = curso.modulos[Number(moduloId)];
            }

            if (modulo && Array.isArray(modulo.lecciones)) {
                let indice = modulo.lecciones.findIndex((l) =>
                    String(l._id) === String(leccionId) || String(l.id) === String(leccionId)
                );
                if (indice === -1 && /^\d+$/.test(String(leccionId))) {
                    indice = Number(leccionId);
                }

                if (indice >= 0 && indice < modulo.lecciones.length) {
                    modulo.lecciones.splice(indice, 1);
                    await curso.save();
                    req.flash('success_msg', 'Lección eliminada.');
                }
            }
        }

        res.redirect(`/docente/cursos/${id}/contenido`);
    } catch (err) {
        console.error('Error al eliminar lección:', err);
        res.redirect(`/docente/cursos/${req.params.id}/contenido`);
    }
};

/**
 * @route POST /docente/cursos/:id/recurso/crear
 * @description Adjuntar recursos descargables o enlaces de apoyo al curso.
 */
exports.crearRecurso = async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, tipo, url, descripcion } = req.body;

        const curso = await Course.findOne({ id });
        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/docente/dashboard');
        }

        curso.recursosGlobales.push({
            titulo: titulo.trim(),
            tipo: tipo || 'link',
            url: url.trim(),
            descripcion: descripcion ? descripcion.trim() : ''
        });

        await curso.save();
        req.flash('success_msg', 'Recurso de apoyo agregado al curso.');
        res.redirect(`/docente/cursos/${id}/contenido`);
    } catch (err) {
        console.error('Error al crear recurso docente:', err);
        req.flash('error_msg', 'Error al adjuntar recurso.');
        res.redirect(`/docente/cursos/${req.params.id}/contenido`);
    }
};

/**
 * @route POST /docente/cursos/:id/recurso/:rId/eliminar
 * @description Eliminar un recurso del curso.
 */
exports.eliminarRecurso = async (req, res) => {
    try {
        const { id, rId } = req.params;
        const curso = await Course.findOne({ id });

        if (!curso) {
            req.flash('error_msg', 'Curso no encontrado.');
            return res.redirect('/docente/dashboard');
        }

        const indice = (curso.recursosGlobales || []).findIndex((r) => String(r._id) === String(rId));
        if (indice === -1) {
            req.flash('error_msg', 'El recurso no existe o ya fue eliminado.');
            return res.redirect(`/docente/cursos/${id}/contenido`);
        }

        curso.recursosGlobales.splice(indice, 1);
        await curso.save();
        req.flash('success_msg', 'Recurso eliminado.');

        res.redirect(`/docente/cursos/${id}/contenido`);
    } catch (err) {
        console.error('Error al eliminar recurso:', err);
        res.redirect(`/docente/cursos/${req.params.id}/contenido`);
    }
};

/**
 * @route GET /docente/proyectos
 * @description Vista para que el Docente revise los proyectos prácticos de sus alumnos.
 */
exports.getProyectos = async (req, res) => {
    try {
        // Cursos del docente
        // Admin ve todos; docente solo los de cursos de los que es autor (por _id, no por nombre)
        const filtroCursos = req.user.rol === 'admin' ? {} : { autor: req.user._id };
        const cursos = await Course.find(filtroCursos).select('id titulo');

        const cursoIds = cursos.map(c => c.id);
        // Antes, sin cursos propios la consulta quedaba vacía ({}) y mostraba TODOS los proyectos
        const query = { cursoId: { $in: cursoIds } };

        const proyectos = await StudentProject.find(query).sort({ actualizadoEn: -1 });

        res.render('docente/proyectos', {
            titlePage: 'Revisión de Proyectos Prácticos',
            proyectos,
            cursos
        });
    } catch (err) {
        console.error('Error al cargar proyectos para docente:', err);
        res.status(500).send('Error interno del servidor');
    }
};

/**
 * @route POST /docente/proyectos/:id/retroalimentar
 * @description Guardar retroalimentación y calificación de un proyecto práctico.
 */
exports.retroalimentarProyecto = async (req, res) => {
    try {
        const { id } = req.params;
        const { comentario, calificacion, estado } = req.body;

        const proyecto = await StudentProject.findById(id);
        if (!proyecto) {
            req.flash('error_msg', 'Proyecto no encontrado.');
            return res.redirect('/docente/proyectos');
        }

        // Solo el autor del curso (o un admin) puede calificar el proyecto
        if (req.user.rol !== 'admin') {
            const curso = await Course.findOne({ id: proyecto.cursoId }).select('autor');
            if (!curso || !curso.autor || curso.autor.toString() !== req.user._id.toString()) {
                req.flash('error_msg', 'No tienes permiso para calificar este proyecto.');
                return res.redirect('/docente/proyectos');
            }
        }

        if (comentario && comentario.trim().length > 0) {
            proyecto.retroalimentacion.push({
                docenteId: req.user._id,
                docenteNombre: req.user.nombre,
                docenteRol: 'docente',
                comentario: comentario.trim(),
                calificacion: calificacion ? Number(calificacion) : null,
                fecha: new Date()
            });
        }

        if (estado) {
            proyecto.estado = estado;
        }

        proyecto.actualizadoEn = new Date();
        await proyecto.save();

        req.flash('success_msg', `Retroalimentación enviada al estudiante ${proyecto.estudianteNombre}.`);
        res.redirect('/docente/proyectos');
    } catch (err) {
        console.error('Error al retroalimentar proyecto:', err);
        req.flash('error_msg', 'Error al guardar la retroalimentación.');
        res.redirect('/docente/proyectos');
    }
};
