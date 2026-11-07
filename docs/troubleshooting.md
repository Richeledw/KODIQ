# 🔧 Guía de Solución de Problemas - Eduplat

Esta guía te ayudará a resolver problemas comunes cuando ejecutes la plataforma Eduplat.

---

## 📋 Tabla de Contenidos

1. [Problemas de Instalación](#problemas-de-instalación)
2. [Problemas al Iniciar el Servidor](#problemas-al-iniciar-el-servidor)
3. [Problemas de Navegación](#problemas-de-navegación)
4. [Problemas de Visualización](#problemas-de-visualización)
5. [Problemas de Formularios](#problemas-de-formularios)
6. [Problemas de Rendimiento](#problemas-de-rendimiento)

---

## Problemas de Instalación

### ❌ "Cannot find module 'npm'" o "npm: command not found"

**Causa:** Node.js/npm no está instalado.

**Solución:**
1. Descarga Node.js desde https://nodejs.org/
2. Instala la versión LTS (Long Term Support)
3. Reinicia la terminal
4. Verifica: `npm --version`

---

### ❌ "npm ERR! code EACCES: permission denied"

**Causa:** Problemas de permisos en la carpeta.

**Solución Windows:**
```bash
# Ejecuta la terminal como Administrador
# 1. Click derecho en CMD/PowerShell
# 2. "Ejecutar como administrador"
# 3. Navega a la carpeta
cd c:\Users\ASUS\Desktop\PROGRAMACIÓN\HTML
npm install
```

**Solución MacOS/Linux:**
```bash
sudo npm install
# O mejor:
chown -R $(whoami) ~/.npm
npm install
```

---

### ❌ "npm ERR! code ERR_SOCKET_TIMEOUT"

**Causa:** Problemas de conexión a internet o servidor npm lento.

**Solución:**
```bash
# Intenta de nuevo con más tiempo de espera
npm install --no-audit --timeout=60000

# O cambia el registro de npm
npm config set registry https://registry.npmmirror.com
npm install
```

---

### ❌ "npm WARN deprecated" (advertencias durante install)

**No es un error**, solo advertencias sobre paquetes antiguos. Puedes ignorarlo.

Para actualizar paquetes después:
```bash
npm audit fix
```

---

## Problemas al Iniciar el Servidor

### ❌ "Cannot find module 'express'" después de `npm install`

**Causa:** Las dependencias no se instalaron completamente.

**Solución:**
```bash
# Limpia y reinstala
rm -rf node_modules
rm package-lock.json
npm install
```

<u>En Windows PowerShell:</u>
```powershell
Remove-Item -Recurse -Force .\node_modules
Remove-Item package-lock.json
npm install
```

---

### ❌ "Error: listen EADDRINUSE :::3000"

**Causa:** El puerto 3000 ya está en uso por otro proceso.

**Solución 1 - Usa otro puerto:**
```bash
set PORT=3001
npm run dev
# Luego abre: http://localhost:3001
```

<u>En MacOS/Linux:</u>
```bash
PORT=3001 npm run dev
```

**Solución 2 - Mata el proceso que usa 3000:**

<u>Windows:</u>
```bash
# Encuentra qué proceso usa el puerto 3000
netstat -ano | findstr :3000

# Mata el proceso (reemplaza PID con el número que viste)
taskkill /PID <PID> /F

# Ejemplo:
taskkill /PID 12345 /F
```

<u>MacOS/Linux:</u>
```bash
# Mata el proceso automáticamente
lsof -ti:3000 | xargs kill -9
```

---

### ❌ "nodemon: command not found"

**Causa:** nodemon no está instalado globalmente o localmente.

**Solución:**
```bash
# Reinstala las dependencias
npm install

# O instala nodemon globalmente
npm install -g nodemon
```

---

### ❌ "Error: ENOENT: no such file or directory, open 'views/home.ejs'"

**Causa:** Las plantillas EJS no están en la carpeta correcta.

**Solución:**
1. Verifica que la carpeta `views/` existe en el directorio raíz
2. Verifica que contiene los archivos: `home.ejs`, `temas.ejs`, `curso.ejs`, `registro.ejs`, `contacto.ejs`, `error.ejs`
3. Verifica la ruta en `app.js` línea ~8:
   ```javascript
   app.set('views', path.join(__dirname, 'views'));
   ```

---

### ❌ "Error: Cannot find module 'path'"

**Causa:** Módulo nativo no está disponible.

**Solución:**
Verifica que los primeros líneas de `app.js` incluyen:
```javascript
const express = require('express');
const path = require('path');
const app = express();
```

Si no, agrégalas manualmente.

---

## Problemas de Navegación

### ❌ "Cannot GET /"

**Causa:** La ruta GET / no está definida en `app.js`.

**Solución:**
Verifica que `app.js` incluya:
```javascript
app.get('/', (req, res) => {
  res.render('home', { datosHome: { ... } });
});
```

---

### ❌ "Cannot GET /temas" o "Cannot GET /contacto"

**Causa:** Las rutas no están definidas.

**Solución:**
1. Reinicia el servidor: Presiona `Ctrl+C` y ejecuta `npm run dev`
2. Verifica que `app.js` incluye todas las rutas (líneas ~145-200)
3. Revisa que no hay errores de sintaxis en `app.js`

Para ver todos los errores de sintaxis:
```bash
node app.js
# Si hay errores, se mostrarán aquí
```

---

### ❌ "SyntaxError: Unexpected token" al iniciar

**Causa:** Error de sintaxis en `app.js` o en un archivo que se importa.

**Solución:**
```bash
# Verifica la sintaxis
node -c app.js

# Si hay error, muestra el archivo con números de línea
cat -n app.js | head -20  # Primeras 20 líneas
```

Busca errores comunes:
- Paréntesis sin cerrar `)` o `}`
- Comillas sin cerrar `"` o `'`
- Comas faltantes entre propiedades de objetos

---

## Problemas de Visualización

### ❌ Las páginas no tienen estilos (se ven sin CSS)

**Causa:** Bootstrap 5 no está cargando desde CDN.

**Solución:**
1. Verifica tu conexión a internet
2. Abre la consola del navegador: F12 o Ctrl+Shift+I
3. Ve a la pestaña "Network"
4. Recarga la página
5. Busca si hay errores de red (líneas rojas)
6. Si hay, verifica que las URLs de CDN en las plantillas son correctas:

```html
<!-- En views/home.ejs o cualquier plantilla -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
```

---

### ❌ Los logos SVG no se ven

**Causa:** Los archivos SVG no están en la carpeta correcta.

**Solución:**
1. Verifica que existen en `/static/img/`:
   - `html5.svg`
   - `css3-alt.svg`
   - `js.svg`
   - `python.svg`
   - `mysql.svg`
   - `typescript.svg`
   - `facebook.svg`
   - `instagram.svg`
   - `linkedin.svg`

2. Verifica que las referencias en `app.js` son correctas (líneas ~30-125):
   ```javascript
   'html': {
     // ...
     icono: '/static/img/html5.svg',  // ← Correcta
   }
   ```

3. Abre la consola del navegador (F12) y ve a Network
4. Filtra por "img" para ver si hay errores al cargar los SVG

---

### ❌ Font Awesome icons no se ven (solo código: "")

**Causa:** Font Awesome 6 no está cargando correctamente.

**Solución:**
1. Verifica que el CDN está en todas las plantillas:
   ```html
   <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
   ```

2. Usa clases correctas de Font Awesome 6:
   ```html
   <!-- ✅ Correcto (Font Awesome 6) -->
   <i class="fa-solid fa-heart"></i>
   <i class="fa-brands fa-facebook"></i>

   <!-- ❌ Incorrecto (Font Awesome 5) -->
   <i class="fas fa-heart"></i>
   ```

3. Verifica en la consola (F12) que el CSS se cargó sin errores

---

### ❌ Las imágenes se ven distorsionadas o mal proporcionadas

**Causa:** Tamaños de contenedor incorrectos.

**Solución:**
En `static/styles.css`, ajusta:
```css
.curso-imagen {
  width: 100%;
  height: 200px;
  object-fit: cover;  /* Mantiene proporciones */
}
```

---

## Problemas de Formularios

### ❌ Al enviar el formulario, la página se recarga sin hacer nada

**Causa:** La ruta POST no está definida o está devolviendo un error.

**Solución:**
1. Abre la consola del navegador: F12
2. Ve a la pestaña "Network"
3. Envía el formulario
4. Busca la petición POST
5. Verifica el estado (debe ser 200, no en rojo)
6. Si es error, haz clic en la petición para ver detalles

---

### ❌ "Cannot POST /registro" o "Cannot POST /contacto"

**Causa:** Las rutas POST no están definidas.

**Solución:**
Verifica que `app.js` incluye:
```javascript
app.post('/registro', (req, res) => {
  const { nombre, email, password } = req.body;
  // ... procesar datos
  res.render('home', { mensaje: 'Registrado exitosamente' });
});

app.post('/contacto', (req, res) => {
  const { nombre, email, asunto, mensaje } = req.body;
  // ... procesar datos
  res.render('contacto', { 
    mensaje_exito: '¡Mensaje enviado! Te responderemos pronto.' 
  });
});
```

Si no están, agrégalas manualmente.

---

### ❌ El formulario se envía pero los datos no se guardan

**Causa:** No hay base de datos integrada (solo simula).

**Solución:**
Esta es la versión básica de Eduplat. Para guardar datos, necesitas:

1. **Opción A - Base de datos MongoDB** (más fácil):
   ```bash
   npm install mongoose
   ```
   Luego modifica `app.js` para guardar datos en MongoDB.

2. **Opción B - Base de datos PostgreSQL**:
   ```bash
   npm install pg sequelize
   ```

3. **Opción C - Archivo JSON** (prototipado):
   Los datos se guardan en un archivo `data.json` local.

Para el momento, los datos se solo se muestran en la consola:
```
Nombre: [nombre del usuario]
Email: [email del usuario]
```

---

## Problemas de Rendimiento

### ❌ El servidor es muy lento

**Causa:** Múltiples razones posibles.

**Solución:**

1. **Verifica CPU/Memoria:**
   ```bash
   # Abre Task Manager (Windows)
   # O Activity Monitor (MacOS)
   # O: top (Linux)
   ```
   Si hay 100% CPU, reinicia el servidor.

2. **Limpia caché:**
   ```bash
   npm cache clean --force
   ```

3. **Actualiza Node.js:**
   ```bash
   node --version  # Verifica versión actual
   # Descarga la última de https://nodejs.org/
   ```

4. **Desactiva nodemon** (en desarrollo):
   En lugar de `npm run dev`, usa `npm start` - es más rápido pero no se reinicia automáticamente.

---

### ❌ Las plantillas EJS se cargan lentamente

**Causa:** Las plantillas tienen mucho JavaScript o muchas variables.

**Solución:**
1. Minimiza el uso de variables en bucles
2. Traslada lógica a `app.js` en lugar de templates
3. Cachea datos que no cambian frecuentemente

---

## ✅ Checklist de Diagnóstico

Antes de reportar un problema, verifica:

- [ ] Node.js está instalado: `node --version`
- [ ] npm está actualizado: `npm --version`
- [ ] Estás en la carpeta correcta: `cd c:\Users\ASUS\Desktop\PROGRAMACIÓN\HTML`
- [ ] Las dependencias están instaladas: `npm install`
- [ ] No hay archivos antiguos conflictivos: `rm -rf node_modules` (si falla algo)
- [ ] El servidor inicia sin errores: `npm run dev`
- [ ] Accedes a http://localhost:3000
- [ ] Abres la consola del navegador (F12) sin errores rojos
- [ ] Las rutas responden (no "Cannot GET")
- [ ] Los estilos se cargan (no todo blanco/gris)

---

## 📞 Obtener Más Ayuda

1. **Revisa los logs:**
   ```bash
   npm run dev 2>&1 | tee server.log
   # Esto guarda logs en server.log
   ```

2. **Envía el error exacto** que ves en la consola

3. **Descripción del problema:**
   - ¿En qué paso falla?
   - ¿Qué viste en la consola?
   - ¿Qué quisiste hacer?

---

**¡Esperamos que esta guía te ayude a resolver tus problemas!** 🚀

*Versión 1.0.0 - Febrero 2025*
