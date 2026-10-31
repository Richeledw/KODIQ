# 📚 Guía de Cursos - Eduplat

Documentación completa sobre cómo gestionar, crear y personalizar cursos en la plataforma Eduplat.

---

## 📋 Tabla de Contenidos

1. [Estructura de Datos de Cursos](#estructura-de-datos-de-cursos)
2. [Cursos Disponibles](#cursos-disponibles)
3. [Agregar un Nuevo Curso](#agregar-un-nuevo-curso)
4. [Modificar un Curso Existente](#modificar-un-curso-existente)
5. [Valores Permitidos](#valores-permitidos)
6. [Ejemplos Avanzados](#ejemplos-avanzados)
7. [Consejos de Diseño](#consejos-de-diseño)

---

## Estructura de Datos de Cursos

Cada curso en Eduplat está representado como un objeto con las siguientes propiedades:

```javascript
{
  // Obligatorio: Identificador único (usado en URLs)
  id: 'html',

  // Obligatorio: Título del curso
  titulo: 'HTML Básico',

  // Obligatorio: Descripción detallada del curso
  descripcion: 'Aprende los fundamentos de HTML...',

  // Obligatorio: URL del icono/logo SVG
  icono: '/static/img/html5.svg',

  // Opcional: Categoría del curso
  categoria: 'web',

  // Opcional: Nivel de dificultad
  nivel: 'Beginner',

  // Opcional: Calificación (1-5 estrellas)
  calificacion: 4.5,

  // Opcional: Número de reseñas
  resenas: 234,

  // Obligatorio: Duración del curso
  duracion: '8 horas',

  // Obligatorio: Número de lecciones
  lecciones: 24,

  // Obligatorio: Color Bootstrap (para tarjetas)
  color: 'primary',

  // Opcional: Array de cursos relacionados
  cursos_relacionados: [
    {
      id: 'css',
      titulo: 'CSS Esencial'
    },
    {
      id: 'javascript',
      titulo: 'JavaScript Introducción'
    }
  ]
}
```

---

## Cursos Disponibles

Estos son los 6 cursos incluidos por defecto en Eduplat:

### 1. HTML Básico
```
URL: /curso/html
ID: html
Icono: /static/img/html5.svg
Nivel: Beginner
Duración: 8 horas
Lecciones: 24
Calificación: 4.5 ⭐ (234 reseñas)
```

### 2. CSS Esencial
```
URL: /curso/css
ID: css
Icono: /static/img/css3-alt.svg
Nivel: Beginner
Duración: 10 horas
Lecciones: 30
Calificación: 4.7 ⭐ (189 reseñas)
```

### 3. JavaScript Introducción
```
URL: /curso/javascript
ID: javascript
Icono: /static/img/js.svg
Nivel: Intermediate
Duración: 16 horas
Lecciones: 40
Calificación: 4.8 ⭐ (312 reseñas)
```

### 4. Python Fundamental
```
URL: /curso/python
ID: python
Icono: /static/img/python.svg
Nivel: Beginner
Duración: 12 horas
Lecciones: 35
Calificación: 4.9 ⭐ (267 reseñas)
```

### 5. SQL Databases
```
URL: /curso/sql
ID: sql
Icono: /static/img/mysql.svg
Nivel: Intermediate
Duración: 14 horas
Lecciones: 38
Calificación: 4.6 ⭐ (198 reseñas)
```

### 6. TypeScript Mastery
```
URL: /curso/typescript
ID: typescript
Icono: /static/img/typescript.svg
Nivel: Advanced
Duración: 18 horas
Lecciones: 45
Calificación: 4.7 ⭐ (156 reseñas)
```

---

## Agregar un Nuevo Curso

### Paso 1: Preparar el Logo SVG

1. Coloca el logo SVG en `/static/img/` con un nombre descriptivo
   - Ejemplo: `react.svg`
   - Asegúrate que sea un archivo SVG válido
   - Tamaño recomendado: 100x100px o mayor

### Paso 2: Abrir app.js

1. Abre el archivo `app.js`
2. Busca el objeto `cursos` (alrededor de línea 30)
3. Localiza el final del último curso (antes del cierre de `}`)

### Paso 3: Agregar el Nuevo Curso

Agrega una nueva entrada al objeto `cursos`:

```javascript
const cursos = {
  // ... cursos existentes ...

  'react': {
    id: 'react',
    titulo: 'React.js Avanzado',
    descripcion: 'Domina React.js y crea aplicaciones dinámicas...',
    icono: '/static/img/react.svg',
    categoria: 'web',
    nivel: 'Intermediate',
    calificacion: 4.8,
    resenas: 187,
    duracion: '16 horas',
    lecciones: 40,
    color: 'info',
    cursos_relacionados: [
      { id: 'javascript', titulo: 'JavaScript Introducción' },
      { id: 'typescript', titulo: 'TypeScript Mastery' }
    ]
  }
};
```

### Paso 4: Guardar

1. Presiona `Ctrl+S` para guardar
2. Si use `npm run dev`, el servidor se reiniciará automáticamente
3. Accede a: http://localhost:3000/curso/react

---

## Modificar un Curso Existente

### Cambiar el Título

En `app.js`, busca el curso y modifica:

```javascript
'python': {
  titulo: 'Python Fundamental (edición 2025)', // ← Cambio
  // ... resto de propiedades
}
```

### Cambiar la Calificación

```javascript
'css': {
  calificacion: 4.9,  // ← Cambio de 4.7 a 4.9
  resenas: 250,        // ← Actualiza también las reseñas
  // ... resto de propiedades
}
```

### Cambiar el Logo

```javascript
'html': {
  icono: '/static/img/html5-v2.svg', // ← Nuevo logo
  // ... resto de propiedades
}
```

### Actualizar Duración y Lecciones

```javascript
'javascript': {
  duracion: '20 horas',  // ← Aumento de duración
  lecciones: 50,          // ← Más lecciones
  // ... resto de propiedades
}
```

---

## Valores Permitidos

### ID del Curso

- **Requisito:** Solo letras minúsculas, números y guiones
- Ejemplos válidos: `html`, `css`, `javascript`, `web-design`, `python3`
- Ejemplos inválidos: `My Course`, `HTML`, `curso #1`
- **IMPORTANTE:** El ID es único y se usa en la URL

### Categoría

Valores recomendados:
- `web` → Para cursos web (HTML, CSS, JavaScript, React)
- `backend` → Para cursos de backend (Python, Node.js, Java)
- `database` → Para cursos de bases de datos (SQL, MongoDB)
- `data` → Para ciencia de datos (Python, R, análisis)
- `mobile` → Para desarrollo móvil (React Native, Flutter)
- `design` → Para diseño (UI/UX, Figma, Adobe)

Puedes agregar más según necesites.

### Nivel

Valores permitidos:
- `Beginner` - Para principiantes (sin requisitos previos)
- `Intermediate` - Nivel intermedio (requiere conocimientos básicos)
- `Advanced` - Nivel avanzado (requiere experiencia previa)

### Color

Usa clases de color Bootstrap 5:

| Clase | Color |
|-------|-------|
| `primary` | Azul principal |
| `secondary` | Secundario |
| `success` | Verde (éxito) |
| `danger` | Rojo (peligro) |
| `warning` | Naranja (advertencia) |
| `info` | Azul (información) |
| `light` | Gris claro |
| `dark` | Gris oscuro |

### Calificación

- Valor numérico entre **1.0 y 5.0**
- Ejemplos: 4.5, 4.8, 4.9
- **Nota:** Se muestra con estrellas en la interfaz

### Reseñas

- Valor numérico (cantidad de reseñas)
- Ejemplos: 234, 500, 1000
- Afecta la credibilidad del curso

---

## Ejemplos Avanzados

### Ejemplo 1: Curso Gratuito

```javascript
'html-gratis': {
  id: 'html-gratis',
  titulo: 'HTML Gratis para Principiantes',
  descripcion: 'Un curso completamente gratuito de HTML...',
  icono: '/static/img/html5.svg',
  categoria: 'web',
  nivel: 'Beginner',
  calificacion: 4.4,
  resenas: 1250,        // Muchas reseñas por ser gratis
  duracion: '6 horas',  // Más corto
  lecciones: 18,
  color: 'success',
  cursos_relacionados: [
    { id: 'css', titulo: 'CSS Esencial' }
  ]
}
```

### Ejemplo 2: Curso Premium

```javascript
'nodejs-premium': {
  id: 'nodejs-premium',
  titulo: 'Node.js & Express Mastery (Premium)',
  descripcion: 'Crea aplicaciones backend profesionales...',
  icono: '/static/img/nodejs.svg',
  categoria: 'backend',
  nivel: 'Advanced',
  calificacion: 4.95,   // Calificación altísima
  resenas: 45,          // Pocas reseñas (es premium)
  duracion: '24 horas', // Contenido extenso
  lecciones: 60,
  color: 'danger',
  cursos_relacionados: [
    { id: 'javascript', titulo: 'JavaScript Introducción' },
    { id: 'typescript', titulo: 'TypeScript Mastery' },
    { id: 'sql', titulo: 'SQL Databases' }
  ]
}
```

### Ejemplo 3: Especialización (Multiple Cursos Relacionados)

```javascript
'web-development': {
  id: 'web-development',
  titulo: 'Web Development Completo',
  descripcion: 'Aprende frontend y backend en un solo curso...',
  icono: '/static/img/html5.svg',
  categoria: 'web',
  nivel: 'Intermediate',
  calificacion: 4.8,
  resenas: 523,
  duracion: '40 horas',
  lecciones: 100,
  color: 'primary',
  cursos_relacionados: [
    { id: 'html', titulo: 'HTML Básico' },
    { id: 'css', titulo: 'CSS Esencial' },
    { id: 'javascript', titulo: 'JavaScript Introducción' },
    { id: 'nodejs-premium', titulo: 'Node.js & Express Mastery' },
    { id: 'sql', titulo: 'SQL Databases' }
  ]
}
```

---

## Consejos de Diseño

### 1. Nombres de Cursos

✅ **Bueno:**
- "Python Fundamental"
- "Advanced JavaScript Techniques"
- "Machine Learning with TensorFlow"

❌ **Evitar:**
- "My Python Course"
- "JavaScripttttt"
- "LEARN EVERYTHING ABOUT WEB"

**Regla:** Mantenlo profesional, claro y descriptivo.

---

### 2. Descripciones

✅ **Bueno:**
```
Aprende HTML5 desde cero. Incluye estructura semántica, 
formularios, multimedia y mejores prácticas. Al final, 
crearás un portfolio profesional. Ideal para principiantes.
```

❌ **Evitar:**
```
Un curso de HTML lol
```

**Regla:** Escribe 2-3 párrafos explicando qué aprenderá el estudiante.

---

### 3. Duración

Sé realista:
- Beginner: 6-12 horas
- Intermediate: 12-20 horas
- Advanced: 18-30+ horas

**Fórmula:** lecciones × 15-20 minutos = duración aproximada

---

### 4. Lecciones

Mantén la proporción:
```
Beginner:     20-30 lecciones
Intermediate: 30-50 lecciones
Advanced:     40-60+ lecciones
```

---

### 5. Colores

Usa colores consistentes por categoría:

```javascript
const coloresPorCategoria = {
  'web': 'primary',          // Azul para web
  'backend': 'danger',       // Rojo para backend
  'database': 'success',     // Verde para bases de datos
  'data': 'info',            // Azul claro para datos
  'mobile': 'warning',       // Naranja para móvil
  'design': 'secondary'      // Gris para diseño
};
```

---

### 6. Relaciones Entre Cursos

Agrupa cursos relacionados:

```javascript
// Ruta web estándar
html → css → javascript → react

// Ruta backend
python → django → databases → deployment

// Ruta full-stack
html → css → javascript → nodejs → databases
```

---

## Checklist para Agregar un Curso

- [ ] Logo SVG guardado en `/static/img/`
- [ ] ID único (sin espacios, solo minúsculas)
- [ ] Título descriptivo y profesional
- [ ] Descripción completa (2-3 párrafos)
- [ ] Categoría asignada
- [ ] Nivel definido (Beginner, Intermediate, Advanced)
- [ ] Calificación realista (1-5)
- [ ] Número de reseñas lógico
- [ ] Duración coherente con lecciones
- [ ] Color Bootstrap 5 asignado
- [ ] Cursos relacionados enlazados
- [ ] Archivo `app.js` guardado
- [ ] Servidor reiniciado
- [ ] URL `/curso/[id]` accesible
- [ ] Página se carga con estilos correctos

---

## 🔄 Automatización Futura

Para expansión masiva de cursos, considera:

1. **Migrar a Base de Datos**
   ```bash
   npm install mongoose
   # O
   npm install sequelize pg
   ```

2. **Crear Admin Panel**
   - Interfaz para agregar/editar cursos
   - Sin necesidad de editar código

3. **Importar desde CSV**
   ```javascript
   npm install csv-parser
   ```

4. **Sincronizar con CMS Externo**
   - Contentful
   - Strapi
   - WordPress API

---

## 📞 Preguntas Frecuentes

**P: ¿Cuántos cursos puedo agregar?**
R: Ilimitado. Mientras más, mejor para el negocio. El rendimiento dependerá de tu servidor.

**P: ¿Puedo cambiar el color de un curso sin saber CSS?**
R: Sí, usa una de las 8 clases de color Bootstrap predefinidas (primary, danger, success, etc.).

**P: ¿Qué pasa si dos cursos tienen el mismo ID?**
R: El segundo sobrescribirá al primero. Los IDs deben ser únicos.

**P: ¿Cómo muestro solo algunos cursos?**
R: En `app.js`, filtra el array antes de pasarlo a la plantilla:
```javascript
const cursosFiltrados = Object.values(cursos).filter(c => c.categoria === 'web');
```

**P: ¿Puedo reordenar los cursos?**
R: Sí, en `app.js` ordena antes de renderizar:
```javascript
const cursosOrdenados = Object.values(cursos).sort((a, b) => b.calificacion - a.calificacion);
```

---

**¡Mantén tu catálogo de cursos actualizado y atractivo!** 📚✨

*Versión 1.0.0 - Febrero 2025*
