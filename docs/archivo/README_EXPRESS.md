# 🎓 Eduplat - Plataforma de Aprendizaje

Una plataforma moderna de aprendizaje en línea construida con **Node.js**, **Express** y **EJS**. Diseñada para ser escalable, mantenible y fácil de personalizar.

## 📋 Índice

- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Configuración](#configuración)
- [Rutas Disponibles](#rutas-disponibles)
- [Plantillas EJS](#plantillas-ejs)
- [Personalización](#personalización)
- [Recursos Usados](#recursos-usados)

---

## ✅ Requisitos

- **Node.js** (v14.0 o superior)
- **npm** (v6.0 o superior)
- Un editor de código (VS Code recomendado)

---

## 🚀 Instalación

### 1. Instalar Dependencias

```bash
npm install
```

Esto instalará todas las dependencias del archivo `package.json`:

- **express**: Framework web minimalista
- **ejs**: Motor de plantillas
- **nodemon** (dev): Reinicia automáticamente el servidor en cambios

### 2. Iniciar el Servidor

**Modo Desarrollo** (con nodemon - reinicia automáticamente):

```bash
npm run dev
```

**Modo Producción**:

```bash
npm start
```

El servidor estará disponible en: **http://localhost:3000**

---

## 📁 Estructura del Proyecto

```
eduplat/
├── app.js                    # Servidor principal
├── package.json              # Dependencias del proyecto
├── README.md                 # Este archivo
│
├── views/                    # Plantillas EJS
│   ├── home.ejs             # Página de inicio
│   ├── temas.ejs            # Listado de cursos
│   ├── curso.ejs            # Detalle del curso (Plantilla Maestra)
│   ├── registro.ejs         # Formulario de registro
│   ├── contacto.ejs         # Formulario de contacto
│   └── error.ejs            # Página de error 404
│
├── static/                   # Archivos estáticos
│   ├── styles.css           # Estilos CSS personalizados
│   ├── script.js            # JavaScript del cliente
│   ├── form_validation.js   # Validación de formularios
│   ├── img/                 # Imágenes y logos SVG
│   │   ├── html5.svg
│   │   ├── css3-alt.svg
│   │   ├── js.svg
│   │   ├── python.svg
│   │   ├── mysql.svg
│   │   ├── typescript.svg
│   │   ├── facebook.svg
│   │   ├── instagram.svg
│   │   └── linkedin.svg
│   └── templates/           # Archivos HTML estáticos antiguos
│
└── node_modules/            # Dependencias instaladas (generado)
```

---

## ⚙️ Configuración

### Estructura de app.js

El archivo principal `app.js` está organizado en 5 secciones:

#### 1. **Configuración de EJS y Vistas**

```javascript
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
```

#### 2. **Middleware**

```javascript
app.use(express.static(path.join(__dirname, 'static')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
```

#### 3. **Datos de Cursos** (Base de datos simulada)

```javascript
const cursos = {
  'html': { id: 'html', titulo: 'HTML Básico', ... },
  'css': { id: 'css', titulo: 'CSS Esencial', ... },
  // ... más cursos
};
```

#### 4. **Rutas Principales**

- `GET /` → Página de inicio
- `GET /temas` → Listado de cursos
- `GET /registro` → Formulario de registro
- `POST /registro` → Procesar registro
- `GET /contacto` → Formulario de contacto
- `POST /contacto` → Procesar contacto

#### 5. **Rutas Dinámicas**

- `GET /curso/:id` → Detalle del curso

---

## 🛣️ Rutas Disponibles

### Rutas Estáticas

| Método | Ruta        | Descripción                  |
| ------ | ----------- | ---------------------------- |
| GET    | `/`         | Página de inicio             |
| GET    | `/temas`    | Listado de todos los cursos  |
| GET    | `/registro` | Formulario de registro       |
| POST   | `/registro` | Procesar datos del registro  |
| GET    | `/contacto` | Formulario de contacto       |
| POST   | `/contacto` | Procesar mensaje de contacto |

### Rutas Dinámicas

| Método | Ruta         | Descripción                    |
| ------ | ------------ | ------------------------------ |
| GET    | `/curso/:id` | Detalle de un curso específico |

#### Cursos Disponibles (IDs)

```
/curso/html          → HTML Básico
/curso/css           → CSS Esencial
/curso/javascript    → JavaScript Introducción
/curso/python        → Python Fundamental
/curso/sql           → SQL Databases
/curso/typescript    → TypeScript Mastery
```

**Ejemplo:**

```
http://localhost:3000/curso/python
http://localhost:3000/curso/javascript
```

---

## 🎨 Plantillas EJS

### Plantilla Maestra: `curso.ejs`

Es la plantilla más completa que renderiza cursos dinámicamente:

**Variables que recibe:**

```javascript
{
  datosCurso: {
    id: string,              // ID único del curso
    titulo: string,          // Título del curso
    descripcion: string,     // Descripción detallada
    icono: string,           // URL del icono/logo
    categoria: string,       // web, backend, data, design, mobile
    nivel: string,           // Beginner, Intermediate, Advanced
    calificacion: number,    // 1-5 estrellas
    resenas: number,         // Cantidad de reseñas
    duracion: string,        // Ej: "8 horas"
    lecciones: number,       // Cantidad de lecciones
    color: string,           // Clase CSS para colores
    cursos_relacionados: []  // Array de cursos similares
  }
}
```

**Características:**

- Header con gradiente y información del curso
- Descripción detallada
- Listado de lecciones
- Sidebar con información y botón de inscripción
- Sección de cursos relacionados
- Responsive design con Bootstrap 5
- Font Awesome 6 para iconos

### Otras Plantillas

| Plantilla      | Propósito                              |
| -------------- | -------------------------------------- |
| `home.ejs`     | Página de inicio con cursos destacados |
| `temas.ejs`    | Listado completo de cursos             |
| `registro.ejs` | Formulario de registro con validación  |
| `contacto.ejs` | Formulario de contacto y información   |
| `error.ejs`    | Página de error 404 personalizada      |

---

## 📝 Ejemplos de Uso

### Acceder a un Curso

```javascript
// En app.js
app.get('/curso/:id', (req, res) => {
    const { id } = req.params;
    const curso = cursos[id];

    if (!curso) {
        return res.status(404).render('error', {
            mensaje: 'Curso no encontrado',
            descripcion: 'El curso que buscas no existe.'
        });
    }

    res.render('curso', { datosCurso: curso });
});
```

### Agregar un Nuevo Curso

```javascript
// Agregar a la base de datos simulada
const cursos = {
    // ... cursos existentes ...
    react: {
        id: 'react',
        titulo: 'React.js Avanzado',
        descripcion: 'Crea interfaces modernas con React...',
        icono: '/static/img/react.svg',
        categoria: 'web',
        nivel: 'Intermediate',
        calificacion: 4.8,
        resenas: 187,
        duracion: '16 horas',
        lecciones: 40,
        color: 'warning'
    }
};
```

### Usar Variables en Plantillas

```ejs
<!-- En las plantillas EJS -->

<!-- Interpolación -->
<h1><%= datosCurso.titulo %></h1>

<!-- Condicionales -->
<% if(datosCurso.nivel === 'Beginner') { %>
  <span class="badge bg-success">Principiante</span>
<% } %>

<!-- Bucles -->
<% datosCurso.cursos_relacionados.forEach(curso => { %>
  <a href="/curso/<%= curso.id %>"><%= curso.titulo %></a>
<% }); %>
```

---

## 🔧 Personalización

### Cambiar Puerto

En `app.js`, línea ~170:

```javascript
const PORT = process.env.PORT || 3000; // Cambia 3000 por otro puerto
```

### Agregar Datos del Curso

Edita el objeto `cursos` en `app.js` (líneas ~30-125):

```javascript
const cursos = {
    'mi-curso': {
        id: 'mi-curso',
        titulo: 'Mi Nuevo Curso',
        descripcion: 'Descripción del curso...'
        // ... más propiedades
    }
};
```

### Personalizar Bootstrap

Las plantillas usan **Bootstrap 5.3** vía CDN. Para personalizar:

1. Crea archivo `static/custom-bootstrap.css`
2. Importa en las plantillas después del CDN de Bootstrap

### Cambiar Colores

Los colores están definidos en CSS:

```css
:root {
    --color-primary: #3b82f6;
    --color-success: #10b981;
    --color-warning: #f59e0b;
    --color-danger: #ef4444;
    --color-info: #06b6d4;
}
```

---

## 📚 Recursos Usados

### Framework & Librerías

- **Express.js 4.18.2** - Framework web
- **EJS 3.1.10** - Motor de plantillas
- **Node.js** - Entorno de ejecución

### UI & Diseño

- **Bootstrap 5.3** - Framework CSS (CDN)
- **Font Awesome 6.4** - Iconos (CDN)
- **Logos SVG** - Iconos de tecnologías (`/static/img/`)

### Características Implementadas

✅ Servidor Node.js con Express  
✅ Plantilla maestra EJS  
✅ Rutas dinámicas con parámetros  
✅ Archivos estáticos servidos correctamente  
✅ Bootstrap 5 (sin Bootstrap 4)  
✅ Font Awesome 6 via CDN  
✅ SVG para iconos locales  
✅ Código limpio y escalable  
✅ Formularios con método GET/POST  
✅ Manejo de errores 404

---

## 🚀 Próximos Pasos

1. **Base de Datos**: Integrar MongoDB o PostgreSQL en lugar de datos simulados
2. **Autenticación**: Agregar login/logout con JWT o Passport.js
3. **API REST**: Crear endpoints API para el móvil
4. **Búsqueda**: Implementar búsqueda y filtros de cursos
5. **Carrito**: Agregar carrito de compra
6. **Pagos**: Integrar Stripe o PayPal
7. **Certificados**: Sistema de generación de certificados
8. **Notificaciones**: Email transaccionales con Nodemailer

---

## 📧 Soporte

Para preguntas o reportar bugs, contacta a **info@eduplat.com**

---

## 📄 Licencia

Este proyecto está bajo la licencia **MIT**. Siéntete libre de usarlo, modificarlo y distribuirlo.

---

## 👨‍💻 Autor

Creado como plantilla educativa para la plataforma **Eduplat**.

**Versión:** 1.0.0  
**Última actualización:** Febrero 2025

---

**¡Gracias por usar Eduplat!** 🎓✨
