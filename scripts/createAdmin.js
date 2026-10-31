/**
 * @file createAdmin.js
 * @description Crea (o promueve) un administrador desde la consola.
 * Reemplaza al antiguo registro público con ADMIN_SECRET.
 *
 * Uso:
 *   node scripts/createAdmin.js
 *   (pide nombre, email y contraseña; la contraseña no se muestra al escribirla)
 */

require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const User = require('../src/models/User');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

// Pregunta sin mostrar lo que se escribe (para la contraseña)
const askHidden = (q) => new Promise((resolve) => {
    const out = rl.output;
    const originalWrite = rl._writeToOutput;
    rl.question(q, (answer) => {
        rl._writeToOutput = originalWrite;
        out.write('\n');
        resolve(answer);
    });
    rl._writeToOutput = () => {}; // silencia el eco mientras se escribe
});

(async () => {
    try {
        if (!process.env.MONGO_URI) throw new Error('Falta MONGO_URI en .env');

        const nombre = (await ask('Nombre completo: ')).trim();
        const email = (await ask('Email: ')).trim().toLowerCase();
        const password = await askHidden('Contraseña (mín. 8 caracteres): ');

        if (!nombre || !email) throw new Error('Nombre y email son obligatorios.');
        if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');

        await mongoose.connect(process.env.MONGO_URI);

        let user = await User.findOne({ email });
        if (user) {
            user.rol = 'admin';
            user.activo = true;
            await user.save();
            console.log(`\nEl usuario ${email} ya existía: ahora es administrador (su contraseña no se modificó).`);
        } else {
            user = new User({ nombre, email, password, rol: 'admin' });
            await user.save(); // el hash se genera en el hook pre-save del modelo
            console.log(`\nAdministrador creado: ${email}`);
        }
    } catch (err) {
        console.error('\nError:', err.message);
        process.exitCode = 1;
    } finally {
        rl.close();
        await mongoose.disconnect();
    }
})();
