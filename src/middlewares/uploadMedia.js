/**
 * @file uploadMedia.js
 * @description Middleware Multer con motor de almacenamiento directo a MongoDB GridFS.
 * Transmite el archivo en streaming hacia `mediaStorage.guardarDesdeStream` validando
 * tipo MIME, firma binaria ("magic bytes") y límite de tamaño por categoría (500 MB video,
 * 50 MB documentos/archivos, 10 MB imágenes) sin cargarlo completo en memoria RAM.
 */

const multer = require('multer');
const mediaStorage = require('../services/mediaStorage');

const gridFsStorageEngine = {
    _handleFile(req, file, cb) {
        mediaStorage
            .guardarDesdeStream(file.stream, {
                nombreOriginal: file.originalname,
                mimeType: file.mimetype,
                metadata: {
                    cursoId: req.params ? req.params.id : null,
                    subidoPor: req.user ? String(req.user._id) : null
                }
            })
            .then((info) => cb(null, info))
            .catch((err) => cb(err));
    },
    _removeFile(_req, file, cb) {
        if (file && file.gridFsId) {
            mediaStorage
                .eliminarArchivo(file.gridFsId)
                .then(() => cb(null))
                .catch((err) => cb(err));
        } else {
            cb(null);
        }
    }
};

const uploadMulter = multer({
    storage: gridFsStorageEngine,
    limits: {
        fileSize: mediaStorage.limiteMaximo(),
        files: 1
    },
    fileFilter(_req, file, cb) {
        if (mediaStorage.tipoPermitido(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new mediaStorage.MediaError(`Tipo de archivo no permitido (${file.mimetype}).`, 415));
        }
    }
});

/**
 * Middleware para subir un archivo al curso (campo `archivo`).
 */
function uploadCourseMedia(req, res, next) {
    uploadMulter.single('archivo')(req, res, (err) => {
        if (!err) return next();

        const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
        const mensaje =
            err.code === 'LIMIT_FILE_SIZE'
                ? 'El archivo supera el tamaño máximo permitido.'
                : err.message || 'No se pudo procesar el archivo subido.';

        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(status).json({ success: false, msg: mensaje });
        }

        if (req.flash) req.flash('error_msg', mensaje);
        const fallback = req.params && req.params.id ? `/docente/cursos/${req.params.id}/contenido` : '/panel';
        return res.redirect(fallback);
    });
}

module.exports = {
    uploadCourseMedia,
    gridFsStorageEngine
};
