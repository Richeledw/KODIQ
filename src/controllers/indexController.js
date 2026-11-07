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
        // SEGURIDAD: forzamos string para que un body como email[$gt]= no llegue como objeto.
        const nombre = String(req.body.nombre || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const asunto = String(req.body.asunto || '').trim();
        const mensaje = String(req.body.mensaje || '').trim();

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

/**
 * @route GET /sitemap.xml
 * @description Genera dinámicamente el mapa del sitio XML con cursos publicados para indexación SEO.
 */
exports.getSitemap = async (req, res) => {
    try {
        const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
        const cursos = await Course.find({ publicado: true }).select('id actualizadoEn creadoEn');

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        const paginasFijas = [
            { path: '/', priority: '1.0', changefreq: 'daily' },
            { path: '/temas', priority: '0.9', changefreq: 'daily' },
            { path: '/contacto', priority: '0.5', changefreq: 'monthly' },
            { path: '/login', priority: '0.4', changefreq: 'monthly' },
            { path: '/registro', priority: '0.6', changefreq: 'monthly' }
        ];

        for (const p of paginasFijas) {
            xml += `  <url>\n    <loc>${appUrl}${p.path}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
        }

        for (const c of cursos) {
            const fecha = (c.actualizadoEn || c.creadoEn || new Date()).toISOString().split('T')[0];
            xml += `  <url>\n    <loc>${appUrl}/curso/${c.id}</loc>\n    <lastmod>${fecha}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
        }

        xml += '</urlset>';

        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        res.status(500).end();
    }
};
