/**
 * @file mediaController.js
 * @description Controlador para subir, listar, transmitir (con HTTP Range para video)
 * y eliminar archivos almacenados en MongoDB GridFS (`MediaAsset`).
 */

const MediaAsset = require('../models/MediaAsset');
const mediaStorage = require('../services/mediaStorage');
const mediaService = require('../services/mediaService');
const contentService = require('../services/contentService');
const logger = require('../utils/logger');

/**
 * GET /media/:assetId
 * Sirve un archivo desde GridFS verificando permisos (inscritos, autor, admin o vista previa)
 * y soportando HTTP Range (`206 Partial Content`) para adelantar/retroceder videos.
 */
exports.servirMedia = async (req, res) => {
    try {
        const { assetId } = req.params;
        if (!mediaService.esObjectId(assetId)) {
            return res.status(400).json({ success: false, msg: 'Identificador de archivo no válido.' });
        }

        const asset = await MediaAsset.findById(assetId);
        if (!asset) {
            return res.status(404).json({ success: false, msg: 'Archivo no encontrado.' });
        }

        const autorizado = await mediaService.puedeVerAsset(asset, req.user);
        if (!autorizado) {
            const codigo = req.user ? 403 : 401;
            return res.status(codigo).json({
                success: false,
                msg: req.user
                    ? 'Debes estar inscrito en el curso para acceder a este archivo.'
                    : 'Debes iniciar sesión para acceder a este archivo.'
            });
        }

        const nombreDescarga = encodeURIComponent(asset.nombreOriginal || `archivo${asset.extension}`);
        const forzarDescarga = req.query.download === '1' || asset.categoria === 'archivo';
        const disposicion = forzarDescarga ? 'attachment' : 'inline';

        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'none'; media-src 'self'; img-src 'self'; style-src 'unsafe-inline'; sandbox"
        );
        res.setHeader('Content-Type', asset.mimeType);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Disposition', `${disposicion}; filename*=UTF-8''${nombreDescarga}`);
        res.setHeader('Cache-Control', asset.publico ? 'public, max-age=86400' : 'private, max-age=3600');

        const rango = mediaStorage.parsearRango(req.headers.range, asset.tamano);
        if (rango === false) {
            res.setHeader('Content-Range', `bytes */${asset.tamano}`);
            return res.status(416).end();
        }

        if (rango) {
            const longitud = rango.end - rango.start + 1;
            res.status(206);
            res.setHeader('Content-Range', `bytes ${rango.start}-${rango.end}/${asset.tamano}`);
            res.setHeader('Content-Length', String(longitud));
            const streamParcial = mediaStorage.abrirDescarga(asset.gridFsId, rango);
            streamParcial.on('error', (err) => {
                logger.error({ err, assetId }, 'Error transmitiendo rango desde GridFS');
                if (!res.headersSent) res.status(500).end();
            });
            return streamParcial.pipe(res);
        }

        res.status(200);
        res.setHeader('Content-Length', String(asset.tamano));
        const streamCompleto = mediaStorage.abrirDescarga(asset.gridFsId);
        streamCompleto.on('error', (err) => {
            logger.error({ err, assetId }, 'Error transmitiendo archivo desde GridFS');
            if (!res.headersSent) res.status(500).end();
        });
        return streamCompleto.pipe(res);
    } catch (err) {
        logger.error({ err }, 'Error al servir archivo de GridFS');
        if (!res.headersSent) {
            return res.status(500).json({ success: false, msg: 'Error al leer el archivo.' });
        }
    }
};

/**
 * POST /curso/:id/media/subir
 * Registra en `MediaAsset` el archivo recién subido a GridFS por `uploadCourseMedia`.
 */
exports.subirMediaCurso = async (req, res) => {
    try {
        if (!req.file || !req.file.gridFsId) {
            return res.status(400).json({ success: false, msg: 'No se recibió ningún archivo válido.' });
        }

        const curso = req.curso || (await contentService.resolverCurso(req.params.id));
        const asset = await mediaService.registrarAsset(req.file, {
            curso,
            usuario: req.user,
            nombreOriginal: req.body.titulo || req.file.nombreArchivo,
            descripcion: req.body.descripcion || '',
            publico: req.body.publico === 'true' || req.body.publico === true,
            duracionSeg: req.body.duracionSeg
        });

        await contentService.recalcularEstadisticas(curso);

        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(201).json({
                success: true,
                asset: asset.toObject({ virtuals: true })
            });
        }

        req.flash('success_msg', `Archivo "${asset.nombreOriginal}" subido correctamente.`);
        return res.redirect(`/docente/cursos/${curso.id}/contenido`);
    } catch (err) {
        logger.error({ err }, 'Error al registrar archivo subido al curso');
        const status = err.status || 500;
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(status).json({ success: false, msg: err.message || 'Error al registrar el archivo.' });
        }
        req.flash('error_msg', err.message || 'Error al registrar el archivo.');
        return res.redirect(`/docente/cursos/${req.params.id}/contenido`);
    }
};

/**
 * GET /curso/:id/media
 * Lista los archivos asociados a un curso (solo autor del curso o admin).
 */
exports.listarMediaCurso = async (req, res) => {
    try {
        const curso = req.curso || (await contentService.resolverCurso(req.params.id));
        const assets = await mediaService.listarAssetsDeCurso(curso._id, {
            categoria: req.query.categoria
        });
        return res.json({ success: true, assets });
    } catch (err) {
        logger.error({ err }, 'Error al listar archivos del curso');
        return res.status(err.status || 500).json({ success: false, msg: err.message });
    }
};

/**
 * DELETE /curso/:id/media/:assetId
 * Elimina un archivo de GridFS y su registro en `MediaAsset` (si no está en uso).
 */
exports.eliminarMediaCurso = async (req, res) => {
    try {
        const curso = req.curso || (await contentService.resolverCurso(req.params.id));
        const forzar = req.query.forzar === '1' || req.body.forzar === true;
        const eliminado = await mediaService.eliminarAsset(req.params.assetId, { forzar });
        await contentService.recalcularEstadisticas(curso);

        if (req.xhr || req.headers.accept?.includes('json') || req.method === 'DELETE') {
            return res.json({ success: true, eliminadoId: eliminado._id });
        }

        req.flash('success_msg', 'Archivo eliminado correctamente.');
        return res.redirect(`/docente/cursos/${curso.id}/contenido`);
    } catch (err) {
        logger.error({ err }, 'Error al eliminar archivo del curso');
        const status = err.status || 500;
        if (req.xhr || req.headers.accept?.includes('json') || req.method === 'DELETE') {
            return res.status(status).json({ success: false, msg: err.message });
        }
        req.flash('error_msg', err.message || 'No se pudo eliminar el archivo.');
        return res.redirect(`/docente/cursos/${req.params.id}/contenido`);
    }
};
