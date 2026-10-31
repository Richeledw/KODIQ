/**
 * @file upload.js
 * @description Middleware para gestión y almacenamiento seguro de avatares con Multer.
 *
 * SEGURIDAD (por qué es así):
 *  - El `mimetype` lo envía el cliente y se puede falsificar; el nombre del archivo también.
 *    Por eso la extensión final se deduce de una whitelist y NO de `originalname`.
 *  - Después de subir se verifican los "magic bytes" reales del archivo. Si no coinciden
 *    con una imagen JPG/PNG/WebP, el archivo se borra y se rechaza.
 *  - Así nadie puede subir un .html/.svg/.js disfrazado de imagen y servirlo desde tu dominio.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Directorio de avatares (se crea si no existe)
const avatarDir = path.join(__dirname, '../../public/uploads/avatars');
if (!fs.existsSync(avatarDir)) {
    fs.mkdirSync(avatarDir, { recursive: true });
}

// Whitelist: tipo MIME permitido -> extensión que se guarda en disco
const EXT_BY_MIME = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
};

const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
        const userId = req.user ? req.user._id : 'temp';
        // La extensión sale de la whitelist, jamás del nombre que envió el cliente
        cb(null, `avatar-${userId}-${Date.now()}${EXT_BY_MIME[file.mimetype]}`);
    }
});

const imageFilter = (req, file, cb) => {
    if (Object.prototype.hasOwnProperty.call(EXT_BY_MIME, file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes en formato JPG, PNG o WebP.'));
    }
};

const multerAvatar = multer({
    storage: avatarStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 2 * 1024 * 1024, files: 1 } // 2 MB, un solo archivo
});

/**
 * Comprueba que el contenido real del archivo sea JPG, PNG o WebP.
 * @param {string} filePath Ruta del archivo ya guardado en disco
 * @returns {boolean}
 */
function hasImageSignature(filePath) {
    const fd = fs.openSync(filePath, 'r');
    try {
        const buf = Buffer.alloc(12);
        fs.readSync(fd, buf, 0, 12, 0);
        const isJpg  = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
        const isPng  = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
        const isWebp = buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
        return isJpg || isPng || isWebp;
    } finally {
        fs.closeSync(fd);
    }
}

/**
 * Middleware listo para usar en rutas: sube el avatar, valida contenido y maneja errores
 * con un mensaje flash en vez de dejar que Express devuelva un 500.
 */
const uploadAvatar = (req, res, next) => {
    multerAvatar.single('avatar')(req, res, (err) => {
        if (err) {
            const msg = err.code === 'LIMIT_FILE_SIZE'
                ? 'La imagen supera el máximo de 2 MB.'
                : (err.message || 'No se pudo procesar la imagen.');
            req.flash('error_msg', msg);
            return res.redirect('/configuracion');
        }

        if (req.file && !hasImageSignature(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { /* ya no existe */ }
            req.flash('error_msg', 'El archivo no es una imagen válida (JPG, PNG o WebP).');
            return res.redirect('/configuracion');
        }

        next();
    });
};

module.exports = {
    uploadAvatar,
    hasImageSignature
};
