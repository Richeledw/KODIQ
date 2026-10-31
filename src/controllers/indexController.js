/**
 * @file indexController.js
 * @description Controlador para manejar las páginas estáticas y generales del sitio web (página de inicio y contacto).
 */

const ContactMessage = require('../models/ContactMessage');
const Course = require('../models/Course');
const staticCursos = require('../models/cursosData');

/**
 * @route GET /
 * @description Renderiza la página de inicio (home) con cursos dinámicos obtenidos de MongoDB.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.getHome = async (req, res) => {
    try {
        let cursos = await Course.find({ publicado: true }).sort({ creadoEn: -1 }).limit(6);
        if (!cursos || cursos.length === 0) {
            cursos = Object.values(staticCursos).slice(0, 6);
        }
        res.render('home', {
            datosHome: {
                titulo: 'Eduplat - Tu Plataforma de Aprendizaje',
                subtitulo: 'Aprende nuevas habilidades con cursos de calidad',
                cursosDestacados: cursos
            }
        });
    } catch (err) {
        console.error('Error al obtener cursos para la home:', err);
        res.render('home', {
            datosHome: {
                titulo: 'Eduplat - Tu Plataforma de Aprendizaje',
                subtitulo: 'Aprende nuevas habilidades con cursos de calidad',
                cursosDestacados: Object.values(staticCursos).slice(0, 6)
            }
        });
    }
};

/**
 * @route GET /contacto
 * @description Renderiza el formulario de contacto con la información institucional de soporte.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.getContacto = (req, res) => {
    res.render('contacto', {
        datosContacto: {
            titulo: 'Contáctanos',
            descripcion: 'Nos gustaría saber de ti',
            email: 'info@eduplat.com',
            telefono: '+54 9 1234567890',
            ubicacion: 'Buenos Aires, Argentina'
        }
    });
};

/**
 * @route POST /contacto
 * @description Procesa el envío del formulario de contacto y lo almacena en MongoDB (ContactMessage).
 * @param {object} req - Objeto de solicitud de Express conteniendo el cuerpo del mensaje.
 * @param {object} res - Objeto de respuesta de Express.
 */
exports.postContacto = async (req, res) => {
    try {
        const { nombre, email, asunto, mensaje } = req.body;

        if (!nombre || !email || !asunto || !mensaje) {
            return res.render('contacto', {
                datosContacto: {
                    titulo: 'Contáctanos',
                    descripcion: 'Nos gustaría saber de ti',
                    email: 'info@eduplat.com',
                    telefono: '+54 9 1234567890',
                    ubicacion: 'Buenos Aires, Argentina'
                },
                mensaje_error: 'Por favor completa todos los campos del formulario.'
            });
        }

        await ContactMessage.create({
            nombre: nombre.trim(),
            email: email.trim().toLowerCase(),
            asunto: asunto.trim(),
            mensaje: mensaje.trim()
        });

        res.render('contacto', {
            datosContacto: {
                titulo: 'Contáctanos',
                descripcion: 'Nos gustaría saber de ti',
                email: 'info@eduplat.com',
                telefono: '+54 9 1234567890',
                ubicacion: 'Buenos Aires, Argentina'
            },
            mensaje_exito: '¡Gracias por tu mensaje! Tu consulta ha sido registrada y nuestro equipo de soporte te responderá a la brevedad.'
        });
    } catch (err) {
        console.error('Error al guardar mensaje de contacto:', err);
        res.render('contacto', {
            datosContacto: {
                titulo: 'Contáctanos',
                descripcion: 'Nos gustaría saber de ti',
                email: 'info@eduplat.com',
                telefono: '+54 9 1234567890',
                ubicacion: 'Buenos Aires, Argentina'
            },
            mensaje_error: 'Ocurrió un error al procesar tu solicitud. Por favor intenta nuevamente.'
        });
    }
};
