// form_validation.js

/**
 * Muestra un mensaje de alerta (error o éxito) en el formulario.
 * Esta función depende de que exista el div con id="alert-message"
 * y el p con id="alert-text" en el HTML.
 * @param {string} message El texto del mensaje.
 * @param {string} type El tipo de mensaje ('error' para rojo, 'success' para verde).
 */
function showAlert(message, type = 'error') {
    const alertMessage = document.getElementById('alert-message');
    const alertText = document.getElementById('alert-text');
    
    // Si los elementos de la alerta no existen, salimos para evitar errores.
    if (!alertMessage || !alertText) {
        console.error("Error: Elementos de alerta (alert-message o alert-text) no encontrados en el DOM.");
        return;
    }
    
    // Limpiar clases anteriores y dejar las clases base
    alertMessage.className = 'mb-4 p-3 rounded-md transition duration-300';
    
    let classes = '';
    
    if (type === 'error') {
        // Estilos de alerta de error (rojo con Tailwind)
        classes = 'bg-red-100 border border-red-400 text-red-700';
    } else if (type === 'success') {
        // Estilos de alerta de éxito (verde con Tailwind)
        classes = 'bg-green-100 border border-green-400 text-green-700';
    }
    
    // Aplicar clases de estilo y mostrar el mensaje
    alertMessage.classList.add(...classes.split(' '));
    alertText.textContent = message;
    alertMessage.classList.remove('hidden');
}

/**
 * Maneja el envío del formulario, realiza validaciones y muestra alertas.
 * Asume que el botón de envío llama a esta función con onclick="handleAuthSubmit()".
 */
function handleAuthSubmit() {
    // 1. Obtener referencias y valores
    const emailInput = document.getElementById('email-register');
    const passwordInput = document.getElementById('password-register');
    
    // Verificar que los campos existen
    if (!emailInput || !passwordInput) {
        console.error("Error: Campos de email o contraseña no encontrados en el DOM.");
        return;
    }
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // Ocultar mensaje anterior antes de la nueva validación
    const alertMessage = document.getElementById('alert-message');
    if (alertMessage) {
        alertMessage.classList.add('hidden');
    }

    // 2. Simulación de Validación Front-end (Campos requeridos y formato)
    
    // Validar formato de correo básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showAlert('Por favor, introduce un correo electrónico válido.', 'error');
        emailInput.focus();
        return;
    }

    // Validar longitud de la contraseña
    if (password.length < 6) {
        showAlert('La contraseña debe tener al menos 6 caracteres.', 'error');
        passwordInput.focus();
        return;
    }

    // 3. Simulación de Validación Back-end (Autenticación)
    
    // Caso de error simulado: Credenciales no válidas
    // Simula lo que pasaría si el servidor devuelve un error de credenciales
    if (email.toLowerCase() === 'error@test.com') {
        showAlert('Error de credenciales. El correo o la contraseña son incorrectos.', 'error');
        return;
    }
    
    // Caso de éxito simulado
    showAlert('¡Acceso Exitoso! Bienvenido a la plataforma.', 'success');
    
    // En una aplicación real, aquí ejecutarías el fetch/axios para el login/registro
    // y redirigirías al usuario si el servidor responde correctamente.
    // Ejemplo: window.location.href = 'index.html'; 
}

// Nota: Si este archivo se fusionara con el script.js de temas.html,
// debes asegurarte de que las funciones no colisionen y de que
// solo se ejecute la lógica de temas en temas.html y la de registro
// en registro.html, o que ambas estén disponibles si es necesario.