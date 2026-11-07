# 🚀 Guía Rápida de Inicio - Eduplat

Una guía paso a paso para instalar y ejecutar la plataforma Eduplat por primera vez.

---

## ⚡ Inicio en 3 Pasos

### Paso 1: Instalar Dependencias
```bash
npm install
```

**¿Qué hace?**
- Descarga e instala Express.js, EJS y nodemon
- Crea la carpeta `node_modules/`
- Genera el archivo `package-lock.json`

**Tiempo estimado:** 1-2 minutos (depende de tu conexión a internet)

---

### Paso 2: Iniciar el Servidor

**Para Desarrollo** (recomendado mientras trabajas):
```bash
npm run dev
```

**Para Producción**:
```bash
npm start
```

**Output esperado:**
```
Server corriendo en http://localhost:3000
Rutas disponibles:
  GET  /
  GET  /temas
  GET  /registro
  POST /registro
  GET  /contacto
  POST /contacto
  GET  /curso/:id
```

---

### Paso 3: Abrir en Navegador

Abre tu navegador y accede a:
```
http://localhost:3000
```

✅ **¡Listo!** La plataforma está funcionando.

---

## 📍 Rutas Principales

Después de iniciar el servidor, puedes visitar:

### Páginas Estáticas
- **Inicio:** http://localhost:3000/
- **Todos los Cursos:** http://localhost:3000/temas
- **Registro:** http://localhost:3000/registro
- **Contacto:** http://localhost:3000/contacto

### Cursos Dinámicos
- **HTML:** http://localhost:3000/curso/html
- **CSS:** http://localhost:3000/curso/css
- **JavaScript:** http://localhost:3000/curso/javascript
- **Python:** http://localhost:3000/curso/python
- **SQL:** http://localhost:3000/curso/sql
- **TypeScript:** http://localhost:3000/curso/typescript

---

## 🛑 Detener el Servidor

Presiona en la terminal:
```bash
Ctrl + C
```

---

## 🔧 Comandos Útiles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Iniciar en modo desarrollo (se reinicia al cambiar archivos) |
| `npm start` | Iniciar en modo producción (requiere reinicio manual) |
| `npm install` | Instalar todas las dependencias |
| `npm install nombre-paquete` | Agregar un nuevo paquete |

---

## 📁 Estructura de Archivos Importante

```
proyecto/
├── app.js                 ← Servidor principal
├── package.json           ← Configuración del proyecto
├── views/                 ← Páginas HTML (plantillas EJS)
│   ├── home.ejs          ← Página de inicio
│   ├── temas.ejs         ← Listado de cursos
│   ├── curso.ejs         ← Detalle de un curso
│   ├── registro.ejs      ← Formulario de registro
│   ├── contacto.ejs      ← Formulario de contacto
│   └── error.ejs         ← Página de error
└── static/               ← Archivos estáticos (CSS, JS, imágenes)
    ├── styles.css
    ├── script.js
    └── img/              ← Logos SVG
        ├── html5.svg
        ├── css3.svg
        └── ... (otros logos)
```

---

## ✨ Características Implementadas

✅ **Servidor Node.js** con Express.js  
✅ **Motor de Plantillas** EJS integrado  
✅ **Rutas Dinámicas** para cursos (/curso/:id)  
✅ **Bootstrap 5** para diseño responsivo  
✅ **Font Awesome 6** para iconos  
✅ **Logos SVG** personalizados  
✅ **Archivos Estáticos** servidos correctamente  
✅ **Validación de Formularios** básica  
✅ **Manejo de Errores** 404 personalizado  

---

## 🤔 Errores Comunes

### ❌ Error: "Cannot find module 'express'"
**Solución:** Ejecuta `npm install`

### ❌ Error: "Port 3000 already in use"
**Solución:** 
```bash
# Option 1: Usa otro puerto
set PORT=3001
npm start

# Option 2: Mata el proceso que usa 3000
lsof -ti:3000 | xargs kill -9  # MacOS/Linux
netstat -ano | findstr :3000    # Windows
```

### ❌ Error: "ENOENT: no such file or directory"
**Solución:** Asegúrate de estar en la carpeta correcta, ejecuta:
```bash
cd c:\Users\ASUS\Desktop\PROGRAMACIÓN\HTML
npm install
npm run dev
```

---

## 📝 Agregar un Nuevo Curso

1. Abre `app.js`
2. Busca el objeto `cursos` (alrededor de línea 30)
3. Agrega una nueva entrada:

```javascript
'react': {
  id: 'react',
  titulo: 'React.js Mastery',
  descripcion: 'Aprende a crear interfaces dinámicas con React...',
  icono: '/static/img/react.svg',
  categoria: 'web',
  nivel: 'Intermediate',
  calificacion: 4.9,
  resenas: 234,
  duracion: '20 horas',
  lecciones: 50,
  color: 'info',
  cursos_relacionados: [
    { id: 'javascript', titulo: 'JavaScript Introducción' },
    { id: 'typescript', titulo: 'TypeScript Mastery' }
  ]
}
```

4. Guarda el archivo
5. Si usas `npm run dev`, el servidor se reiniciará automáticamente
6. Accede a: http://localhost:3000/curso/react

---

## 🎨 Personalizar Colores

Los cursos usan clases Bootstrap para colores:
- `info` → Azul
- `success` → Verde
- `warning` → Naranja
- `danger` → Rojo
- `primary` → Azul principal

En `app.js`, cambia el valor `color` de un curso:

```javascript
'python': {
  // ...
  color: 'warning'  // Cambia esto
}
```

---

## 📦 Instalar Nuevos Paquetes

Si necesitas agregar funcionalidad:

```bash
npm install nombre-del-paquete
```

**Ejemplos útiles:**
```bash
npm install mongoose          # MongoDB
npm install passport          # Autenticación
npm install nodemailer        # Enviar emails
npm install dotenv            # Variables de entorno
npm install cors              # CORS para APIs
```

---

## 🌐 Acceso Remoto

Para acceder desde otro dispositivo en la red:

1. Obtén tu IP local:
   ```bash
   ipconfig | findstr "IPv4"  # Windows
   ifconfig | grep inet        # MacOS/Linux
   ```

2. Inicia el servidor:
   ```bash
   npm run dev
   ```

3. Accede desde otro dispositivo:
   ```
   http://TU_IP:3000
   ```

---

## 📖 Documentación Completa

Para más detalles, consulta **README_EXPRESS.md** (documentación completa).

---

## ✅ Checklist de Instalación

- [ ] Node.js instalado (`node --version` en terminal)
- [ ] npm instalado (`npm --version` en terminal)
- [ ] Carpeta del proyecto lista
- [ ] `npm install` ejecutado sin errores
- [ ] `npm run dev` iniciado correctamente
- [ ] Acceso a http://localhost:3000 en navegador
- [ ] Todas las páginas cargan con estilos Bootstrap 5
- [ ] Logos SVG se ven en los cursos
- [ ] Iconos Font Awesome 6 se ven correctamente

---

## 🆘 Necesitas Ayuda?

1. **Revisa la documentación:** README_EXPRESS.md
2. **Checa los logs:** Observa los mensajes en la terminal
3. **Reinicia el servidor:** Presiona Ctrl+C y vuelve a ejecutar `npm run dev`
4. **Limpia dependencias:** Elimina `node_modules/` y ejecuta `npm install` nuevamente

---

**¡Disfruta usando Eduplat!** 🎓✨

*Versión 1.0.0 - Febrero 2025*
