/**
 * @file navbar-auth.js
 * @description Gestión robusta de persistencia de sesión y renderizado condicional en la UI.
 * Oculta completamente 'Iniciar Sesión' y 'Registrarse' cuando el usuario está autenticado,
 * mostrando su perfil, rol correspondiente y enlace al panel.
 */

(function () {
    const STORAGE_KEY = 'eduplat_user';

    // 1. Sincronización estricta desde variable del servidor (SSR)
    if (typeof window.EDUPLAT_USER !== 'undefined') {
        if (window.EDUPLAT_USER && window.EDUPLAT_USER.id) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(window.EDUPLAT_USER));
            } catch (e) {}
        } else if (window.EDUPLAT_USER === null) {
            // Si el servidor indica explícitamente que no hay sesión, limpiar de inmediato
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (e) {}
        }
    }

    // Helper para leer usuario almacenado
    function getStoredUser() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    // Helper para guardar usuario
    function setStoredUser(user) {
        try {
            if (user && user.id) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch (e) {}
    }

    // Determinar URL y etiqueta del panel según rol
    function getRoleInfo(rol) {
        if (rol === 'admin') {
            return {
                url: '/admin/dashboard',
                label: 'Panel Admin',
                icon: 'fa-user-shield'
            };
        } else if (rol === 'docente' || rol === 'teacher') {
            return {
                url: '/docente/dashboard',
                label: 'Panel Docente',
                icon: 'fa-chalkboard-teacher'
            };
        }
        return {
            url: '/panel',
            label: 'Mi Panel',
            icon: 'fa-user-graduate'
        };
    }

    // Aplicar estado a la UI de forma reactiva y estricta
    function applyAuthState(user) {
        const isAuthenticated = !!(user && (user.id || user.nombre));

        // A. Elementos de Invitado (Login / Registro / CTAs)
        document.querySelectorAll('.nav-auth-guest, [data-auth="guest"], .btn-auth-guest').forEach((el) => {
            if (isAuthenticated) {
                el.style.setProperty('display', 'none', 'important');
                el.classList.add('d-none');
            } else {
                el.style.removeProperty('display');
                el.classList.remove('d-none');
            }
        });

        // B. Elementos de Usuario Autenticado
        document.querySelectorAll('.nav-auth-user, [data-auth="user"], .btn-auth-user').forEach((el) => {
            if (isAuthenticated) {
                el.style.removeProperty('display');
                el.classList.remove('d-none');
            } else {
                el.style.setProperty('display', 'none', 'important');
                el.classList.add('d-none');
            }
        });

        if (isAuthenticated) {
            const roleInfo = getRoleInfo(user.rol);

            // Actualizar enlaces al panel
            document.querySelectorAll('.link-mi-panel').forEach((link) => {
                link.setAttribute('href', roleInfo.url);
            });

            document.querySelectorAll('.link-mi-panel-text').forEach((span) => {
                span.textContent = roleInfo.label;
            });

            document.querySelectorAll('.link-mi-panel-icon').forEach((icon) => {
                icon.className = `fas ${roleInfo.icon} text-muted link-mi-panel-icon`;
            });

            // Actualizar nombre
            document.querySelectorAll('.user-display-name').forEach((span) => {
                span.textContent = user.nombre || 'Usuario';
            });

            // Actualizar email
            document.querySelectorAll('.user-email-display').forEach((span) => {
                span.textContent = user.email || '';
            });

            // Actualizar rol
            document.querySelectorAll('.user-role-badge').forEach((badge) => {
                badge.textContent = user.rol || 'estudiante';
            });

            // Actualizar avatar inicial
            document.querySelectorAll('.user-avatar-badge').forEach((avatar) => {
                if (user.nombre) {
                    avatar.textContent = user.nombre.charAt(0).toUpperCase();
                }
            });
        }
    }

    // 2. Determinar usuario actual
    let currentUser =
        typeof window.EDUPLAT_USER !== 'undefined' && window.EDUPLAT_USER ? window.EDUPLAT_USER : getStoredUser();

    // 3. Verificación asíncrona de respaldo con endpoint de sesión
    function verifySessionWithBackend() {
        fetch('/api/auth/session')
            .then((res) => res.json())
            .then((data) => {
                if (data && data.authenticated && data.user) {
                    setStoredUser(data.user);
                    applyAuthState(data.user);
                } else if (window.EDUPLAT_USER === null) {
                    setStoredUser(null);
                    applyAuthState(null);
                }
            })
            .catch(() => {
                if (currentUser) {
                    applyAuthState(currentUser);
                }
            });
    }

    // 4. Limpieza en Cierre de Sesión (Logout)
    function attachLogoutListeners() {
        document.querySelectorAll('a[href="/logout"], .btn-logout').forEach((btn) => {
            btn.addEventListener('click', function () {
                setStoredUser(null);
                try {
                    sessionStorage.clear();
                } catch (e) {}
            });
        });
    }

    // Inicialización al cargar el DOM
    document.addEventListener('DOMContentLoaded', function () {
        applyAuthState(currentUser);
        attachLogoutListeners();
        verifySessionWithBackend();
    });

    // Escuchar eventos de almacenamiento entre pestañas
    window.addEventListener('storage', function (e) {
        if (e.key === STORAGE_KEY) {
            currentUser = getStoredUser();
            applyAuthState(currentUser);
        }
    });
})();
