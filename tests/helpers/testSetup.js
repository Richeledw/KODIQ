const os = require('os');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const User = require('../../src/models/User');

let mongod = null;
let app = null;

async function setupTestApp() {
    if (!mongod) {
        mongod = await MongoMemoryServer.create({ instance: { dbName: 'eduplat_test' } });
        const testUri = mongod.getUri();
        process.env.NODE_ENV = 'test';
        process.env.SESSION_SECRET = 'test_secret_for_eduplat_tests_1234567890';
        process.env.MONGO_URI = testUri;
        process.env.APP_URL = 'http://localhost:3000';

        await mongoose.connect(testUri, {
            runtimeAdapters: { os }
        });

        app = require('../../server');
        // Esperar a que la sesión persistente de MongoStore quede inicializada
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return { app, mongod };
}

async function cleanupDatabase() {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }
    }
}

async function teardownTestApp() {
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
    if (mongod) {
        await mongod.stop();
        mongod = null;
        app = null;
    }
}

async function createTestUser({
    nombre = 'Test User',
    email = 'test@example.com',
    password = 'password123',
    rol = 'estudiante',
    activo = true
} = {}) {
    return await User.create({
        nombre,
        email,
        password,
        rol,
        activo
    });
}

module.exports = {
    setupTestApp,
    cleanupDatabase,
    teardownTestApp,
    createTestUser
};
