/**
 * @file adminController.js
 * @description Controlador principal para el Panel de Administrador.
 * Modularizado por responsabilidades: usuarios, cursos, proyectos y mensajes.
 */

const userController = require('./admin/userController');
const courseController = require('./admin/courseController');
const projectController = require('./admin/projectController');
const messageController = require('./admin/messageController');

module.exports = {
    ...userController,
    ...courseController,
    ...projectController,
    ...messageController
};
