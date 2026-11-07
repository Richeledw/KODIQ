# Eduplat — Plataforma de Aprendizaje en Línea

Eduplat es una plataforma educativa web full-stack diseñada bajo arquitectura MVC en Node.js, Express y MongoDB. Ofrece aula virtual interactiva, catálogo de cursos técnicos, seguimiento de progreso por lección y módulo, espacio de proyectos prácticos con retroalimentación docente, y emisión de certificados criptográficos verificables.

---

## 🚀 Requisitos del Sistema

- **Node.js**: v20.x o superior (desarrollado y probado en v22.x).
- **npm**: v10.x o superior.
- **MongoDB**: v6.x, v7.x u 8.x corriendo localmente o en MongoDB Atlas.

---

## ⚙️ Instalación y Puesta en Marcha

1. **Clonar o descargar el repositorio:**

    ```bash
    cd Eduplat
    ```

2. **Instalar dependencias:**

    ```bash
    npm install
    ```

3. **Configurar las variables de entorno:**
   Copia el archivo de ejemplo y completa los valores requeridos:

    ```bash
    cp .env.example .env
    ```

    Genera una clave de sesión segura de al menos 48 bytes hexadecimales:

    ```bash
    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
    ```

    Pega el valor generado en la variable `SESSION_SECRET` dentro de tu `.env`.

4. **Crear el Administrador Inicial:**

    ```bash
    node scripts/createAdmin.js
    ```

    Sigue las instrucciones en la consola para registrar el nombre, email y contraseña del primer administrador.

5. **Iniciar la aplicación:**
    - **Modo desarrollo (recarga automática):**
        ```bash
        npm run dev
        ```
    - **Modo producción:**
        ```bash
        npm start
        ```
    Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

## 🔐 Variables de Entorno (`.env`)

| Variable          | Tipo   | Descripción                                                       | Ejemplo / Valor por defecto               |
| :---------------- | :----- | :---------------------------------------------------------------- | :---------------------------------------- |
| `PORT`            | Número | Puerto TCP en el que escucha el servidor Express                  | `3000`                                    |
| `NODE_ENV`        | String | Entorno de ejecución (`development` o `production`)               | `development`                             |
| `APP_URL`         | URL    | URL pública canónica absoluta (evita Host-header poisoning)       | `http://localhost:3000`                   |
| `MONGO_URI`       | Cadena | URI de conexión a la base de datos MongoDB                        | `mongodb://localhost:27017/eduplat`       |
| `SESSION_SECRET`  | String | Secreto criptográfico para firma de cookies de sesión             | Mínimo 16 caracteres (recomendado 64 hex) |
| `SMTP_HOST`       | String | Servidor SMTP para envío de correos (Ethereal / Gmail / SendGrid) | `smtp.ethereal.email` (opcional en dev)   |
| `SMTP_PORT`       | Número | Puerto del servidor SMTP                                          | `587`                                     |
| `SMTP_EMAIL`      | String | Usuario o cuenta de correo del servidor SMTP                      | `usuario@correo.com`                      |
| `SMTP_PASSWORD`   | String | Contraseña o API Key SMTP                                         | `secreto`                                 |
| `SMTP_FROM_EMAIL` | String | Remitente en cabecera From                                        | `noreply@eduplat.com`                     |

---

## 📜 Scripts Disponibles

- `npm start`: Inicia el servidor en modo normal con `node server.js`.
- `npm run dev`: Inicia el servidor en modo desarrollo con recarga automática vía `nodemon`.
- `npm run lint`: Ejecuta el análisis estático de código con ESLint.
- `npm run format`: Formatea el código fuente según las reglas de Prettier.
- `npm test`: Ejecuta la suite de pruebas automatizadas con Jest y Supertest.

---

## 👥 Flujo de Roles y Permisos (RBAC)

1. **Estudiante (`estudiante`):**
    - Rol asignado automáticamente a todo registro público.
    - Puede explorar cursos, inscribirse, visualizar lecciones en el aula virtual, marcar lecciones completadas, enviar avances de proyecto y solicitar su certificado una vez alcanzado el 100% de lecciones y aprobado el proyecto.
2. **Docente (`docente`):**
    - Asignado exclusivamente por un Administrador desde `/admin/usuarios`.
    - Puede crear, editar y estructurar cursos propios (módulos, lecciones, recursos).
    - Accede a su panel docente para revisar y calificar proyectos de sus alumnos.
    - Protegido por el middleware `ownCourse`: un docente no puede modificar ni borrar cursos de otro docente.
3. **Administrador (`admin`):**
    - Creado mediante `node scripts/createAdmin.js`.
    - Control total sobre usuarios (cambio de roles, activación/desactivación), gestión global de cursos, moderación de proyectos y atención de mensajes de contacto.
    - Cuenta con salvaguardas para no auto-degradarse ni eliminar al último administrador activo.

---

## 📂 Estructura del Proyecto

```text
Eduplat/
├── .env.example              # Plantilla de variables de entorno
├── .gitattributes            # Forzado de finales de línea LF
├── .gitignore                # Exclusiones de Git (node_modules, .env, uploads)
├── package.json              # Metadatos, dependencias y scripts npm
├── server.js                 # Punto de entrada principal y configuración Express
├── docs/                     # Documentación técnica, arquitectura y guías
│   ├── arquitectura.md
│   ├── mapa-de-rutas.md
│   ├── troubleshooting.md
│   └── archivo/              # Archivo histórico de notas de desarrollo
├── public/                   # Recursos estáticos reales servidos por Express
│   ├── css/
│   ├── img/
│   ├── js/
│   └── uploads/              # Cargas de avatares protegidas con CSP sandbox
├── scripts/                  # Scripts CLI de mantenimiento y administración
│   ├── createAdmin.js        # Creación y promoción de administradores
│   └── migrateProgress.js    # Migración de progreso a Enrollment
├── src/                      # Código fuente (Arquitectura MVC)
│   ├── config/               # Conexión DB, Passport y validación de entorno
│   ├── controllers/          # Controladores divididos por responsabilidad
│   ├── middlewares/          # Autenticación, ownership, rate-limit, upload, validación
│   ├── models/               # Modelos Mongoose (User, Course, Enrollment, etc.)
│   ├── routes/               # Enrutadores modulares de Express
│   ├── services/             # Lógica de negocio (courseService, progressService)
│   └── utils/                # Utilidades (email, seedCourses, logger)
└── views/                    # Plantillas EJS
    ├── admin/                # Vistas de gestión administrativa
    ├── docente/              # Vistas de cursos y proyectos del docente
    └── partials/             # Componentes reutilizables (navbar, sidebars, flash)
```

---

## 🛡️ Características de Seguridad Implementadas

- **Cabeceras HTTP con Helmet:** Protección XSS, Clickjacking, MIME-sniffing y Content Security Policy (CSP).
- **Anti NoSQL Injection:** `express-mongo-sanitize` y sanitización estricta de tipos.
- **Protección contra Fuerza Bruta:** Limitadores de tasa independientes por IP para login, registro, reset de contraseña y contacto.
- **Sin Enumeración de Usuarios:** Respuestas idénticas y tiempos equiparados con `bcrypt` en inicios de sesión.
- **Prevención de XSS:** Escapado riguroso de caracteres en EJS y uso de nodos DOM en consolas virtuales.
- **Sesiones Seguras:** Cookies `HttpOnly`, `SameSite=lax`, almacenamiento persistente en MongoDB y flag `secure` en producción.
- **Validación de Subidas:** Comprobación dual de archivos (extensión + números mágicos) y aislamiento en directorio `/uploads`.
