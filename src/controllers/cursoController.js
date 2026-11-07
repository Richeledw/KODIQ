/**
 * @file cursoController.js
 * @description Controlador principal para el Catálogo y Aula Virtual de Cursos.
 * Modularizado por responsabilidades: catálogo e inscripción (catalogController)
 * y aula virtual, progreso, proyectos y certificados (playerController).
 */

const catalogController = require('./curso/catalogController');
const playerController = require('./curso/playerController');

module.exports = {
    ...catalogController,
    ...playerController
};
