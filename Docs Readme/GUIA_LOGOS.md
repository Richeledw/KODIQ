# 🎨 Guía: Integración de Logos SVG en la Plataforma

## 📋 Resumen de lo Realizado

Se han integrado exitosamente los logos SVG locales en las tarjetas de cursos para reemplazar los placeholders genéricos. Esto mejora la presentación profesional y la velocidad de carga.

---

## 📁 Logos Disponibles

La carpeta `/static/img/` contiene 10 archivos SVG:

### Logos de Tecnologías (7 archivos)
| Logo | Archivo | Uso |
|------|---------|-----|
| 🟠 HTML5 | `html5.svg` | Curso de HTML Básico |
| 🔵 CSS3 | `css3-alt.svg` | Curso de CSS Esencial |
| 💛 JavaScript | `js.svg` | Curso de JavaScript |
| 🐍 Python | `python.svg` | Curso de Python Fundamental |
| 📘 TypeScript | `typescript.svg` | Curso de TypeScript Mastery |
| 🗄️ MySQL | `mysql.sql` | Curso de SQL Databases |
| 🐘 PHP | `php.svg` | (Disponible para futuros cursos) |

### Logos de Redes Sociales (3 archivos)
| Logo | Archivo | Uso |
|------|---------|-----|
| 📘 Facebook | `facebook.svg` | Enlace a Facebook |
| 📷 Instagram | `instagram.svg` | Enlace a Instagram |
| 💼 LinkedIn | `linkedin.svg` | Enlace a LinkedIn |

---

## 🔧 Procedimiento Realizado

### Paso 1: Estructura de Carpetas
```
static/
  ├── img/
  │   ├── html5.svg
  │   ├── css3-alt.svg
  │   ├── js.svg
  │   ├── python.svg
  │   ├── typescript.svg
  │   ├── mysql.svg
  │   ├── php.svg
  │   ├── facebook.svg
  │   ├── instagram.svg
  │   └── linkedin.svg
  ├── styles.css
  ├── script.js
  └── form_validation.js
```

### Paso 2: Reemplazo de Imágenes en HTML

**Antes (Placeholder genérico):**
```html
<img src="https://placehold.co/300x200/f97316/ffffff?text=HTML+Basico" 
     alt="HTML Básico" 
     class="w-full h-full object-cover">
```

**Después (Logo local):**
```html
<img src="/static/img/html5.svg" 
     alt="HTML Básico" 
     class="w-24 h-24 md:w-32 md:h-32 filter drop-shadow-lg">
```

### Paso 3: Cambios de CSS

- **Ancho/Alto**: `w-24 h-24` (móvil) y `md:w-32 md:h-32` (escritorio)
- **Efecto de sombra**: `filter drop-shadow-lg` para mejor presentación sobre fondos
- **Contenedor**: Mantiene flexbox centrado en `bg-gradient-to-br`

### Paso 4: Actualización de Redes Sociales

**Antes:**
```html
<span class="text-white font-bold">f</span>
```

**Después:**
```html
<img src="/static/img/facebook.svg" 
     alt="Facebook" 
     class="w-5 h-5 filter brightness-0 invert">
```

---

## 📄 Archivos Modificados

1. **`templates/index.html`**
   - Reemplazados 6 cursos (HTML, CSS, JS, Python, SQL, TypeScript)
   - Actualizado footer con logos de redes sociales

2. **`templates/temas.html`**
   - Reemplazados los mismos 6 cursos
   - Mantiene consistencia en ambas páginas

---

## 🎯 Ventajas del Cambio

✅ **Mejor Branding**: Logos profesionales de cada tecnología
✅ **Más Rápido**: SVGs son más ligeros que imágenes PNG
✅ **Escalable**: Los SVGs se adaptan a cualquier resolución
✅ **Consistencia**: Mismo diseño en ambas páginas
✅ **Accesibilidad**: Atributos `alt` descriptivos

---

## 💡 Cómo Agregar Nuevos Logos

Si quieres agregar logos para otros cursos (React, Node.js, Docker, etc.):

1. **Obtén el archivo SVG** de la tecnología
2. **Colócalo en** `/static/img/nombre-curso.svg`
3. **Actualiza la tarjeta** en `index.html` y `temas.html`:

```html
<img src="/static/img/react.svg" 
     alt="React" 
     class="w-24 h-24 md:w-32 md:h-32 filter drop-shadow-lg">
```

---

## 📝 Notas Técnicas

- Los SVGs usan `filter drop-shadow-lg` para sombra en lugar de `box-shadow`
- Las imágenes son responsivas: `24px` (móvil) → `32px` (escritorio)
- Los logos de redes sociales usan `filter brightness-0 invert` para adaptarse al fondo oscuro
- Las rutas son relativas (`/static/img/`) para funcionar en cualquier servidor

---

## 🚀 Resultado Final

Las tarjetas de cursos ahora muestran:
- Logos profesionales de cada tecnología
- Mejor visual y más atractivo
- Mejor rendimiento del sitio
- Experiencia de usuario mejorada
