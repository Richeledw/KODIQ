/**
 * @file mediaService.js
 * @description Lógica de negocio de los archivos subidos (`MediaAsset`):
 * registro tras la subida a GridFS, control de acceso, detección de referencias
 * y borrado seguro (metadatos + binario).
 */

const mongoose = require('mongoose');
const MediaAsset = require('../models/MediaAsset');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const mediaStorage = require('./mediaStorage');

const esObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v)) && /^[0-9a-fA-F]{24}$/.test(String(v));

/**
 * Crea el documento `MediaAsset` para un archivo ya guardado en GridFS.
 * Si falla, elimina el binario para no dejar huérfanos.
 * @param {object} archivo Resultado de mediaStorage.guardarDesdeStream (o req.file del middleware)
 * @param {{curso?:object, usuario:object, nombreOriginal?:string, descripcion?:string, publico?:boolean, duracionSeg?:number}} datos
 */
async function registrarAsset(archivo, { curso, usuario, nombreOriginal, descripcion, publico, duracionSeg }) {
    try {
        return await MediaAsset.create({
            gridFsId: archivo.gridFsId,
            nombreOriginal: String(nombreOriginal || archivo.originalname || archivo.nombreArchivo || 'archivo').slice(
                0,
                255
            ),
            mimeType: archivo.mimeType,
            extension: archivo.extension,
            categoria: archivo.categoria,
            tamano: archivo.tamano,
            sha256: archivo.sha256 || '',
            curso: curso ? curso._id : undefined,
            cursoId: curso ? curso.id : undefined,
            subidoPor: usuario._id,
            publico: Boolean(publico),
            descripcion: descripcion ? String(descripcion).slice(0, 1000) : '',
            duracionSeg: Math.max(0, Number(duracionSeg) || 0)
        });
    } catch (err) {
        await mediaStorage.eliminarArchivo(archivo.gridFsId);
        throw err;
    }
}

/** Sube un Buffer y registra el asset en un solo paso (seeds, scripts y tests). */
async function subirBuffer(buffer, { nombreOriginal, mimeType, curso, usuario, descripcion, publico }) {
    const archivo = await mediaStorage.guardarDesdeBuffer(buffer, {
        nombreOriginal,
        mimeType,
        metadata: { cursoId: curso ? curso.id : null, subidoPor: String(usuario._id) }
    });
    return registrarAsset(archivo, { curso, usuario, nombreOriginal, descripcion, publico });
}

/**
 * ¿Quién está usando este archivo? Devuelve los lugares donde aparece.
 * @param {string} assetId
 */
async function buscarReferencias(assetId) {
    const id = new mongoose.Types.ObjectId(String(assetId));
    const [lecciones, cursos] = await Promise.all([
        Lesson.find({
            $or: [{ 'bloques.asset': id }, { 'bloques.subtitulos.asset': id }, { 'recursos.asset': id }]
        })
            .select('id titulo cursoId')
            .lean(),
        Course.find({ $or: [{ portada: id }, { 'recursosGlobales.asset': id }] })
            .select('id titulo')
            .lean()
    ]);
    return { lecciones, cursos, total: lecciones.length + cursos.length };
}

/**
 * Elimina un asset y su binario. Por defecto se niega si sigue referenciado.
 * @param {string} assetId
 * @param {{forzar?:boolean}} [opciones]
 */
async function eliminarAsset(assetId, { forzar = false } = {}) {
    if (!esObjectId(assetId)) throw new mediaStorage.MediaError('Identificador de archivo no válido', 400);
    const asset = await MediaAsset.findById(assetId);
    if (!asset) throw new mediaStorage.MediaError('Archivo no encontrado', 404);

    if (!forzar) {
        const refs = await buscarReferencias(asset._id);
        if (refs.total > 0) {
            throw new mediaStorage.MediaError(
                `El archivo está en uso en ${refs.total} lugar(es). Quítalo del contenido antes de eliminarlo.`,
                409
            );
        }
    }

    await mediaStorage.eliminarArchivo(asset.gridFsId);
    await asset.deleteOne();
    return asset;
}

/** Elimina todos los archivos de un curso (cascada al borrar el curso). */
async function eliminarAssetsDeCurso(cursoObjectId) {
    const assets = await MediaAsset.find({ curso: cursoObjectId }).select('gridFsId');
    for (const a of assets) {
        await mediaStorage.eliminarArchivo(a.gridFsId);
    }
    await MediaAsset.deleteMany({ curso: cursoObjectId });
    return assets.length;
}

/**
 * Decide si un usuario (o visitante) puede ver/descargar un archivo.
 *  - Públicos: cualquiera.
 *  - Admin, quien lo subió y el autor del curso: siempre.
 *  - Estudiantes inscritos en el curso: sí.
 *  - Visitantes: solo si el archivo aparece en una lección de vista previa publicada.
 */
async function puedeVerAsset(asset, user) {
    if (!asset) return false;
    if (asset.publico) return true;

    if (user) {
        if (user.rol === 'admin') return true;
        if (String(asset.subidoPor) === String(user._id)) return true;

        if (asset.curso) {
            const curso = await Course.findById(asset.curso).select('autor id').lean();
            if (curso && curso.autor && String(curso.autor) === String(user._id)) return true;
            if (curso) {
                const inscrito = await Enrollment.exists({ estudiante: user._id, cursoId: curso.id });
                if (inscrito) return true;
            }
        }
    }

    const enVistaPrevia = await Lesson.exists({
        vistaPrevia: true,
        publicado: true,
        $or: [{ 'bloques.asset': asset._id }, { 'bloques.subtitulos.asset': asset._id }, { 'recursos.asset': asset._id }]
    });
    return Boolean(enVistaPrevia);
}

/** Lista los archivos de un curso (más recientes primero). */
async function listarAssetsDeCurso(cursoObjectId, { categoria } = {}) {
    const filtro = { curso: cursoObjectId };
    if (categoria) filtro.categoria = categoria;
    const assets = await MediaAsset.find(filtro).sort({ creadoEn: -1 }).lean();
    return assets.map((a) => ({ ...a, url: `/media/${a._id}` }));
}

module.exports = {
    esObjectId,
    registrarAsset,
    subirBuffer,
    buscarReferencias,
    eliminarAsset,
    eliminarAssetsDeCurso,
    puedeVerAsset,
    listarAssetsDeCurso
};
