# 🗺️ Mapa de Rutas - Eduplat

Documentación visual y detallada de todas las rutas, endpoints y flujos de navegación en la plataforma Eduplat.

---

## 📊 Diagrama General de Rutas

```
http://localhost:3000
│
├── GET /                    → home.ejs           (Página de inicio)
│   ├── Ver cursos destacados
│   └── Links: /temas, /registro, /contacto
│
├── GET /temas              → temas.ejs          (Todos los cursos)
│   ├── Grid de 6 cursos
│   ├── Links a: /curso/:id
│   └── Links: /, /registro, /contacto
│
├── GET /curso/:id          → curso.ejs          (Detalle del curso)
│   ├── Parámetro: id = [html|css|javascript|python|sql|typescript]
│   ├── Información completa del curso
│   ├── Cursos relacionados
│   └── Links: /temas, /registro, /contacto, /curso/:id (otros cursos)
│
├── GET /registro           → registro.ejs       (Formulario de registro)
│   ├── Formulario: nombre, email, password
│   ├── POST a /registro
│   └── Links: /, /temas, /contacto
│
├── POST /registro          → [Procesa datos]    (Lógica de registro)
│   ├── Recibe: req.body { nombre, email, password }
│   ├── Log en consola
│   └── Redirige: home.ejs con mensaje
│
├── GET /contacto           → contacto.ejs      (Formulario de contacto)
│   ├── Formulario: nombre, email, asunto, mensaje
│   ├── POST a /contacto
│   └── Links: /, /temas, /registro
│
├── POST /contacto          → [Procesa datos]    (Lógica de contacto)
│   ├── Recibe: req.body { nombre, email, asunto, mensaje }
│   ├── Log en consola
│   └── Redirige: contacto.ejs con confirmación
│
└── [CUALQUIER OTRA RUTA]   → error.ejs         (Error 404)
    ├── Mensaje: "Página no encontrada"
    └── Links: /, /temas
```

---

## 📑 Tabla de Rutas Completa

### Rutas Estáticas

| #   | Método | Ruta        | Plantilla      | Descripción                                   |
| --- | ------ | ----------- | -------------- | --------------------------------------------- |
| 1   | GET    | `/`         | `home.ejs`     | Página de inicio con hero y cursos destacados |
| 2   | GET    | `/temas`    | `temas.ejs`    | Listado completo de todos los cursos          |
| 3   | GET    | `/registro` | `registro.ejs` | Formulario de registro de usuarios            |
| 4   | POST   | `/registro` | `home.ejs`     | Procesa datos de registro                     |
| 5   | GET    | `/contacto` | `contacto.ejs` | Formulario de contacto y información          |
| 6   | POST   | `/contacto` | `contacto.ejs` | Procesa mensaje de contacto                   |
| 7   | *      | `[otras]`   | `error.ejs`    | Página 404 para rutas no encontradas          |

### Rutas Dinámicas

| #   | Método | Ruta         | Plantilla   | Descripción                             |
| --- | ------ | ------------ | ----------- | --------------------------------------- |
| 8   | GET    | `/curso/:id` | `curso.ejs` | Detalle dinámico de un curso específico |

---

## 🔄 Flujos de Navegación

### Flujo 1: Explorar Desde el Inicio

```
/ (Inicio)
  ↓ [Click en "Explorar Cursos"]
/temas (Todos los cursos)
  ↓ [Click en un curso]
/curso/:id (Detalle del curso)
  ↓ [Click en "Volver a cursos"]
/temas
```

### Flujo 2: Registro

```
/ (Inicio)
  ↓ [Click en "Crear Cuenta"]
/registro (Formulario)
  ↓ [Completa y envía]
POST /registro (Procesa datos)
  ↓ [Redirige]
/ (Inicio con confirmación)
```

### Flujo 3: Contacto

```
/contacto (Formulario)
  ↓ [Completa y envía]
POST /contacto (Procesa datos)
  ↓ [Muestra confirmación]
/contacto (Con mensaje de éxito)
```

### Flujo 4: Aprendizaje Progresivo

```
/ (Inicio)
  ↓ [Explora cursos]
/temas
  ↓ [Selecciona curso beginner]
/curso/html
  ↓ [Lee información, click "Registro"]
/registro
  ↓ [Crea cuenta]
/ (Ahora es usuarioo registrado)
  ↓ [Click en siguiente curso]
/curso/css
  ↓ [Continúa aprendiendo]
/temas
```

---

## 📍 Rutas Dinámicas Disponibles

### Estructura de /curso/:id

La ruta dinámica `/curso/:id` espera el ID del curso. Los IDs disponibles son:

#### Cursos Disponibles

| ID           | URL                 | Curso                      |
| ------------ | ------------------- | -------------------------- |
| `html`       | `/curso/html`       | 🏷️ HTML Básico             |
| `css`        | `/curso/css`        | 🏷️ CSS Esencial            |
| `javascript` | `/curso/javascript` | 🏷️ JavaScript Introducción |
| `python`     | `/curso/python`     | 🏷️ Python Fundamental      |
| `sql`        | `/curso/sql`        | 🏷️ SQL Databases           |
| `typescript` | `/curso/typescript` | 🏷️ TypeScript Mastery      |

#### URLs Completas

```
http://localhost:3000/curso/html
http://localhost:3000/curso/css
http://localhost:3000/curso/javascript
http://localhost:3000/curso/python
http://localhost:3000/curso/sql
http://localhost:3000/curso/typescript
```

#### ¿Qué Sucede si Uso un ID Inválido?

```
GET /curso/reactjs  ← ID no existe
    ↓
Error 404
    ↓
Renderiza: error.ejs
Con mensaje: "Curso no encontrado"
```

---

## 🎯 Flujo de Datos por Ruta

### 1. GET /

```javascript
// app.js
app.get('/', (req, res) => {
    const datosHome = {
        titulo: 'Eduplat - Aprende Online'
        // ... más datos
    };
    res.render('home', { datosHome });
});
```

**Datos enviados a plantilla:**

- `datosHome` (objeto con información de la página)

**Plantilla:** `views/home.ejs`

---

### 2. GET /temas

```javascript
app.get('/temas', (req, res) => {
    const datosTemas = {
        titulo: 'Nuestros Cursos',
        cursos: Object.values(cursos)
    };
    res.render('temas', { datosTemas });
});
```

**Datos enviados a plantilla:**

- `datosTemas.titulo` (string)
- `datosTemas.cursos` (array de 6 cursosos)

**Plantilla:** `views/temas.ejs`

---

### 3. GET /curso/:id

```javascript
app.get('/curso/:id', (req, res) => {
    const { id } = req.params; // ← Obtiene ID de la URL
    const curso = cursos[id]; // ← Busca en base de datos

    if (!curso) {
        return res.status(404).render('error', {
            mensaje: 'Curso no encontrado',
            descripcion: 'No pudimos encontrar el curso que buscas.'
        });
    }

    // ← Busca cursos relacionados
    const cursosRelacionados = Object.values(cursos)
        .filter((c) => c.categoria === curso.categoria && c.id !== id)
        .slice(0, 3);

    res.render('curso', {
        datosCurso: { ...curso, cursos_relacionados: cursosRelacionados }
    });
});
```

**Flujo:**

1. Cliente visita `/curso/html`
2. Servidor extrae `id = 'html'`
3. Busca en objeto `cursos['html']`
4. Si existe, obtiene cursos relacionados
5. Renderiza `curso.ejs` con datos completos

**Datos enviados a plantilla:**

- `datosCurso` (objeto completo del curso)
- `datosCurso.cursos_relacionados` (array de 3 cursos)

**Plantilla:** `views/curso.ejs`

---

### 4. GET /registro

```javascript
app.get('/registro', (req, res) => {
    res.render('registro', {
        titulo: 'Crea tu Cuenta'
    });
});
```

**Plantilla:** `views/registro.ejs`

---

### 5. POST /registro

```javascript
app.post('/registro', (req, res) => {
    const { nombre, email, password } = req.body;

    console.log(`Nuevoo registro:
    Nombre: ${nombre}
    Email: ${email}
    Password: ${password}`);

    // TODO: Guardar en base de datos
    // TODO: Enviar email de confirmación
    // TODO: Crear sesión de usuario

    res.render('home', {
        datosHome: {
            titulo: 'Eduplat - Aprende Online',
            mensaje: '¡Registro exitoso! Bienvenido.'
        }
    });
});
```

**Datos recibidos:**

- `req.body.nombre` (string)
- `req.body.email` (string)
- `req.body.password` (string)

**Respuesta:** Renderiza `home.ejs` con mensaje de confirmación

---

### 6. GET /contacto

```javascript
app.get('/contacto', (req, res) => {
  res.render('contacto', {
    titulo: 'Contáctanos',
    datosContacto: {...}
  });
});
```

**Plantilla:** `views/contacto.ejs`

---

### 7. POST /contacto

```javascript
app.post('/contacto', (req, res) => {
    const { nombre, email, asunto, mensaje } = req.body;

    console.log(`Nuevo mensaje de contacto:
    Nombre: ${nombre}
    Email: ${email}
    Asunto: ${asunto}
    Mensaje: ${mensaje}`);

    // TODO: Enviar email
    // TODO: Guardar en base de datos

    res.render('contacto', {
        titulo: 'Contáctanos',
        mensaje_exito: '¡Hemos recibido tu mensaje! Te responderemos pronto.'
    });
});
```

**Datos recibidos:**

- `req.body.nombre` (string)
- `req.body.email` (string)
- `req.body.asunto` (string)
- `req.body.mensaje` (string)

**Respuesta:** Renderiza la misma página `contacto.ejs` con mensaje de éxito

---

### 8. Error 404

```javascript
app.use((req, res) => {
    res.status(404).render('error', {
        mensaje: 'Página no encontrada',
        descripcion: 'La dirección que solicitaste no existe.'
    });
});
```

**Cuándo se ejecuta:** Cuando no hay coincidencia con ninguna otra ruta.

**Plantilla:** `views/error.ejs`

---

## 📊 Estructura de Datos

### Objeto Curso

```javascript
{
  // Identificador único
  id: 'html',

  // Información básica
  titulo: 'HTML Básico',
  descripcion: 'Aprende los fundamentos de HTML5...',
  icono: '/static/img/html5.svg',

  // Categorización
  categoria: 'web',
  nivel: 'Beginner',

  // Estadísticas
  calificacion: 4.5,
  resenas: 234,

  // Contenido
  duracion: '8 horas',
  lecciones: 24,

  // Presentación
  color: 'primary',

  // Relaciones
  cursos_relacionados: [
    { id: 'css', titulo: 'CSS Esencial' },
    { id: 'javascript', titulo: 'JavaScript Introducción' }
  ]
}
```

### Objeto datosHome

```javascript
{
  titulo: 'Eduplat - Aprende Online',
  subtitulo: 'Cursos profesionales a tu ritmo',
  // ... más campos según plantilla
}
```

### Objeto datosTemas

```javascript
{
  titulo: 'Nuestros Cursos',
  descripcion: 'Elige entre nuestros mejores cursos...',
  cursos: [
    { id: 'html', titulo: 'HTML Básico', ... },
    { id: 'css', titulo: 'CSS Esencial', ... },
    // ... más cursos
  ]
}
```

---

## 🔐 Métodos HTTP Usados

| Método     | Propósito                      | Ejemplo                     |
| ---------- | ------------------------------ | --------------------------- |
| **GET**    | Obtener dato/Renderizar página | `/`, `/temas`, `/curso/:id` |
| **POST**   | Enviar datos al servidor       | `/registro`, `/contacto`    |
| **PUT**    | Actualizar recurso completo    | _No implementado_           |
| **DELETE** | Eliminar recurso               | _No implementado_           |
| **PATCH**  | Actualizar parcialmente        | _No implementado_           |

---

## 🌐 Códigos HTTP de Respuesta

| Código  | Significado                  | Ejemplo           |
| ------- | ---------------------------- | ----------------- |
| **200** | OK - Solicitud exitosa       | GET / ✅          |
| **201** | Created - Recurso creado     | POST /registro ✅ |
| **302** | Redirect - Redirige          | POST /contacto    |
| **404** | Not Found - No existente     | GET /xyz ❌       |
| **500** | Server Error - Error interno | _No implementado_ |

---

## 🔗 Enlaces Internos por Página

### En home.ejs

```html
<a href="/">Inicio</a>
<a href="/temas">Explorar Cursos</a>
<a href="/registro">Crear Cuenta</a>
<a href="/contacto">Contáctanos</a>
<a href="/curso/html">Ver Curso</a>
```

### En temas.ejs

```html
<a href="/">Inicio</a>
<a href="/curso/<%= curso.id %>">Ver Detalle</a>
<a href="/registro">Inscribirse</a>
<a href="/contacto">Contacto</a>
```

### En curso.ejs

```html
<a href="/temas">Volver a Cursos</a>
<a href="/curso/<%= curso.id %>">Otro Curso</a>
<a href="/registro">Inscribirse</a>
<a href="/contacto">Contacto</a>
```

### En registro.ejs

```html
<a href="/">Inicio</a>
<a href="/temas">Ver Cursos</a>
<a href="/contacto">Contacto</a>
```

### En contacto.ejs

```html
<a href="/">Inicio</a>
<a href="/temas">Ver Cursos</a>
<a href="/registro">Registro</a>
```

---

## 🚀 Parámetros de Ruta

### :id en /curso/:id

**Definición:** Parámetro obligatorio que especifica qué curso mostrar.

**Acceso en código:**

```javascript
const { id } = req.params;
// Express automáticamente extrae "id" de la URL
```

**Ejemplo:**

```
URL: /curso/python
req.params.id = 'python'
```

**Validación:**

```javascript
if (!cursos[id]) {
    // El ID no existe → Error 404
}
```

---

## 📝 Ejemplos de URLs Completas

### Ejercicio 1: Accede a un Curso Específico

```
http://localhost:3000/curso/javascript
```

Esperado:

- Carga la página de JavaScript
- Muestra información, duración, lecciones
- Muestra cursos relacionados

### Ejercicio 2: Enviaar un Formulario

```
1. Ve a: http://localhost:3000/contacto
2. Llena los campos
3. Haz clic en "Enviar"
4. POST /contacto → Renderiza misma página con confirmación
```

### Ejercicio 3: Registrarse

```
1. Ve a: http://localhost:3000/registro
2. Llena nombre, email, password
3. Haz clic en "Crear Cuenta"
4. POST /registro → Renderiza inicio con mensaje de bienvenida
```

---

## 🔧 Próximas Mejoras de Rutas

- Agregar GET `/login` y POST `/login` para autenticación
- Agregar GET `/dashboard` para usuarios registrados
- Agregar DELETE `/curso/:id` para administradores
- Agregar GET `/cursos/categoría/:categoria` para filtros
- Agregar GET `/api/cursos` para cliente API
- Agregar GET `/certificado/:id` para descargar certificados

---

## 📚 Resumen Rápido

**Rutas principales:**

- `/` → Inicio
- `/temas` → Todos los cursos
- `/curso/:id` → Detalle del curso
- `/registro` → Registro de usuarios
- `/contacto` → Formulario de contacto

**Métodos:**

- **GET** → Visualizar
- **POST** → Enviar datos

**Errores:**

- `/xyz` → 404 Not Found

---

**¡Navega libremente por la plataforma Eduplat!** 🚀✨

_Versión 1.0.0 - Febrero 2025_
