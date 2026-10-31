# ✅ Guía Rápida de Verificación

Sigue estos pasos para confirmar que toda la reorganización fue exitosa.

---

## 🚀 Paso 1: Iniciar el Servidor

```bash
cd "c:\Users\ASUS\Desktop\PROGRAMACIÓN\HTML"
npm run dev
```

**Esperado:** Ver mensaje indicando que el servidor está corriendo en `http://localhost:3000`

---

## 🌐 Paso 2: Verificar Cada Página

### ✅ Página de Inicio (`/`)
1. Abre: `http://localhost:3000/`
2. Verifica:
   - [ ] La página carga sin errores
   - [ ] Se ve el hero con gradiente
   - [ ] Six tarjetas de cursos destacados
   - [ ] Footer tiene texto blanco sobre fondo oscuro
   - [ ] Links en footer funcionan

### ✅ Catálogo de Cursos (`/temas`)
1. Abre: `http://localhost:3000/temas`
2. Verifica:
   - [ ] Grid de 6 cursos se muestra
   - [ ] **CRÍTICO:** Cada tarjeta muestra su logo SVG:
     - HTML → logo HTML5 (rojo)
     - CSS → logo CSS3 (azul)
     - JavaScript → logo JS (amarillo)
     - Python → logo Python
     - SQL → logo MySQL
     - TypeScript → logo TypeScript
   - [ ] Footer visible y legible (blanco sobre oscuro)
   - [ ] Botón "Ver Curso" en cada tarjeta funciona

### ✅ Detalle de Curso (`/curso/html`)
1. Abre: `http://localhost:3000/curso/html`
2. Verifica:
   - [ ] Se carga sin errores
   - [ ] Se ve el logo del curso
   - [ ] Información del curso visible
   - [ ] En el footer: "Volver a Cursos" → `/temas` funciona
   - [ ] Footer legible

### ✅ Registro (`/registro`)
1. Abre: `http://localhost:3000/registro`
2. Verifica:
   - [ ] Formulario carga correctamente
   - [ ] Footer legible y con estructura completa
   - [ ] Botón "Registrarse" funciona

### ✅ Contacto (`/contacto`)
1. Abre: `http://localhost:3000/contacto`
2. Verifica:
   - [ ] Formulario carga correctamente
   - [ ] Footer legible y con estructura completa
   - [ ] Botón "Enviar" funciona

---

## 🔍 Paso 3: Verificar en Consola del Navegador (F12)

### Pestaña "Console"
- [ ] NO hay errores rojos
- [ ] NO hay advertencias de `404 Not Found`
- [ ] NO hay referencias a `/static/img/`

### Pestaña "Network"
1. Recarga la página: `Ctrl+F5`
2. Busca archivos:
   - [ ] `/styles.css` → Carga correctamente
   - [ ] `/img/html5.svg` → Carga correctamente
   - [ ] `/img/css3-alt.svg` → Carga correctamente
   - [ ] Otros logos SVG → Cargan correctamente

---

## 🗂️ Paso 4: Verificar Estructura de Carpetas

### Terminal:
```bash
# Verificar que /views existe
dir views

# Verificar que /static existe
dir static

# Verificar que /static/img existe
dir static\img

# Verificar que NO existe /templates
dir templates  # Debe fallar
```

**Esperado:**
```
✅ views/ → Contiene: home.ejs, temas.ejs, curso.ejs, etc.
✅ static/ → Contiene: styles.css, script.js, img/
✅ static/img/ → Contiene: html5.svg, css3-alt.svg, js.svg, etc.
❌ templates/ → NO DEBE EXISTIR
```

---

## 🎨 Paso 5: Verificar Estilos del Footer

En cualquier página, desplázate al footer y verifica:

- [ ] **Color de fondo:** Oscuro (gris oscuro/negro)
- [ ] **Color del texto:** Blanco (claro, legible)
- [ ] **Estructura:** 4 columnas
  - Logo y descripción
  - Enlaces rápidos
  - Contacto
  - Redes sociales
- [ ] **Iconos de redes:** Se ven en blanco
- [ ] **Línea divisora:** Es visible

---

## 📊 Paso 6: Verificar Rutas en app.js

Abre `app.js` y verifica:

```javascript
// ✅ Debe decir /img/ NO /static/img/
'html': {
  icono: '/img/html5.svg',  // ← Correcto
},

'css': {
  icono: '/img/css3-alt.svg', // ← Correcto
},
```

---

## 📝 Paso 7: Verificar Referencias de CSS

En las plantillas EJS, verifica:

```html
<!-- ✅ Debe ser /styles.css NO /static/styles.css -->
<link rel="stylesheet" href="/styles.css">
```

Lugares donde aparece:
- [ ] `views/home.ejs`
- [ ] `views/temas.ejs`
- [ ] `views/curso.ejs`
- [ ] `views/contacto.ejs`
- [ ] `views/registro.ejs`

---

## ✨ Resumen de Verificación

| Elemento | Verificar | Estado |
|----------|-----------|--------|
| Logos SVG en `/temas` | Visibles en cada tarjeta | ✅ |
| Footer estilo | Blanco sobre oscuro | ✅ |
| Rutas de CSS | `/styles.css` sin "static" | ✅ |
| Rutas de imágenes | `/img/` sin "static" | ✅ |
| Links de navegación | Funcionan hacia `/temas` | ✅ |
| Consola del navegador | Sin errores 404 | ✅ |
| Estructura de carpetas | `/views` existe, `/templates` NO | ✅ |
| Responsive | En móvil se ve bien | ✅ |

---

## 🚨 Si Algo No Funciona

### Logos no se ven:
```bash
# 1. Verifica que los archivos existen
ls static/img/

# 2. Reinicia el servidor
npm run dev

# 3. Abre en incógnita
Ctrl+Shift+N y accede a http://localhost:3000/temas
```

### Footer está gris (no blanco):
```bash
# 1. Verifica que Bootstrap 5 CDN carga
# Abre F12 → Network → Busca "bootstrap"

# 2. Verifica que /styles.css carga
# Abre F12 → Network → Busca "styles.css"

# 3. Recarga con Ctrl+F5 (caché limpio)
```

### Rutas no funcionan:
```bash
# 1. Verifica que el servidor está corriendo
# Terminal debe mostrar: "Servidor corriendo en http://localhost:3000"

# 2. Verifica que app.js está correcto
node -c app.js  # Valida sintaxis

# 3. Reinicia el servidor
npm run dev
```

---

## 📞 Soporte

Si tienes problemas:

1. **Consulta los logs de la terminal** → Busca mensajes de error
2. **Abre la consola del navegador (F12)** → Mira los errores rojos
3. **Verifica la estructura de carpetas** → `/views`, `/static` deben existir
4. **Revisa el archivo `app.js`** → Busca rutas de imágenes comentadas

---

## ✅ Confirmación Final

Cuando TODOS los puntos abajo sean ✅, tu reorganización está completa:

- [ ] Logos SVG visibles en `/temas`
- [ ] Footer con texto blanco sobre fondo oscuro
- [ ] Rutas de CSS sin "static"
- [ ] Rutas de imágenes sin "static"
- [ ] Button "Volver a Cursos" funciona
- [ ] No hay errores en consola (F12)
- [ ] `/templates` no existe
- [ ] `/views` contiene solo archivos `.ejs`

---

**¡Una vez todo esté ✅, tu proyecto está listo!** 🎉

*Último check: Febrero 8, 2026*
