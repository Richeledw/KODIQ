# Parches de seguridad aplicados (4 críticos)

| # | Problema | Cambio |
|---|----------|--------|
| 1 | `.env` y `node_modules` versionados | `git rm --cached` (quedan SIN commitear: haz commit), `.env.example`, `public/uploads/` al `.gitignore` |
| 2 | Registro público de admin/docente con claves débiles y fallbacks (`admin123`) | Registro público = solo estudiante. `authController.js`, `views/registro.ejs`. Admin inicial: `node scripts/createAdmin.js`. Docentes: los promueve un admin en `/admin/usuarios`. `server.js` ya no arranca sin `SESSION_SECRET` |
| 3 | Docentes podían editar cursos ajenos / cursos sin autor | Nuevo `src/middlewares/ownCourse.js` aplicado a las 9 rutas `/docente/cursos/:id/*`. Extra: `getProyectos` ya no muestra todos los proyectos a un docente sin cursos y `retroalimentarProyecto` valida el curso |
| 4 | Avatar: extensión/MIME controlados por el cliente | `src/middlewares/upload.js`: extensión por whitelist, verificación de magic bytes, errores con flash; `server.js`: `nosniff` + CSP `sandbox` en `/uploads` |

## Lo que TÚ debes hacer (no se puede desde el código)
1. `git commit` de estos cambios.
2. **Rotar** SMTP_PASSWORD y SESSION_SECRET (siguen en el historial de Git). Quita `DOCENTE_SECRET` y `ADMIN_SECRET` del `.env`.
3. `npm install` (el zip no incluye `node_modules`) y `npm audit fix`.
4. Crea tu admin: `node scripts/createAdmin.js`.
