// ============================================================
// AlephOne — app.js
// Core: auth, routing, utilidades globales, dark mode
// ============================================================

// ─── SANITIZACIÓN ───────────────────────────────────────────
function sanitize(text) {
    if (!text) return '';
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
}

// ─── FECHAS ─────────────────────────────────────────────────
function formatFecha(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatFechaHora(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) +
           ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function diasRestantes(isoString) {
    if (!isoString) return null;
    const diff = new Date(isoString) - new Date();
    return Math.ceil(diff / 86400000);
}

function diaDeHoy() {
    const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    return dias[new Date().getDay()];
}

// ─── AUTH GUARD ─────────────────────────────────────────────
function requireAuth() {
    const user = AlephAPI.Auth.getCurrentUser();
    if (!user) {
        window.location.href = '/frontend/index.html';
        return null;
    }
    return user;
}

function requireRole(role) {
    const user = requireAuth();
    if (!user) return null;
    if (user.role !== role) {
        // Redirigir al dashboard correcto si el rol no coincide
        window.location.href = '/frontend/dashboard.html';
        return null;
    }
    return user;
}

function redirectIfLoggedIn() {
    const user = AlephAPI.Auth.getCurrentUser();
    if (user) {
        window.location.href = '/frontend/dashboard.html';
    }
}

// ─── DARK MODE ───────────────────────────────────────────────
function initDarkMode() {
    const isDark = localStorage.getItem('aleph_dark_mode') === 'true';
    if (isDark) document.body.classList.add('dark-mode');
    const btn = document.getElementById('darkModeBtn');
    if (btn) {
        btn.textContent = isDark ? '☀️' : '🌙';
        btn.addEventListener('click', toggleDarkMode);
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('aleph_dark_mode', isDark);
    const btn = document.getElementById('darkModeBtn');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

// ─── NAVBAR ACTIVA ───────────────────────────────────────────
function setActiveNav() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') && path.includes(link.getAttribute('href'))) {
            link.classList.add('active');
        }
    });
}

// ─── TOAST NOTIFICATIONS ────────────────────────────────────
function showToast(mensaje, tipo = 'info') {
    // tipo: 'info' | 'success' | 'error' | 'warning'
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = `
            position: fixed; bottom: 24px; right: 24px;
            display: flex; flex-direction: column; gap: 10px;
            z-index: 9999;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colores = {
        info:    { bg: '#26D4C7', icon: 'ℹ️' },
        success: { bg: '#28a745', icon: '✓' },
        error:   { bg: '#dc3545', icon: '✗' },
        warning: { bg: '#ffc107', icon: '⚠️' }
    };
    const { bg, icon } = colores[tipo] || colores.info;

    toast.style.cssText = `
        background: ${bg}; color: white; padding: 14px 20px;
        border-radius: 12px; font-size: 0.95em; font-weight: 600;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        display: flex; align-items: center; gap: 10px;
        animation: slideIn 0.3s ease; max-width: 320px;
    `;
    toast.innerHTML = `<span>${icon}</span><span>${sanitize(mensaje)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ─── HEADER DINÁMICO ─────────────────────────────────────────
function renderHeader(user) {
    const usernameEl = document.getElementById('username');
    const roleEl = document.getElementById('userRole');
    if (usernameEl) usernameEl.textContent = user.username;
    if (roleEl) {
        const roles = { student: 'Estudiante', teacher: 'Docente', director: 'Director' };
        roleEl.textContent = roles[user.role] || user.role;
    }
}

// ─── LOGIN ───────────────────────────────────────────────────
function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value;
    const errorEl = document.getElementById('loginError');

    if (!username || !password) {
        if (errorEl) errorEl.textContent = 'Completá todos los campos';
        return false;
    }

    const result = AlephAPI.Auth.login(username, password);
    if (result.ok) {
        window.location.href = './dashboard.html';
    } else {
        if (errorEl) errorEl.textContent = result.error;
    }
    return false;
}

// ─── REGISTER ────────────────────────────────────────────────
function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername')?.value?.trim();
    const email    = document.getElementById('registerEmail')?.value?.trim();
    const password = document.getElementById('registerPassword')?.value;
    const role     = document.getElementById('registerRole')?.value || 'student';
    const errorEl  = document.getElementById('registerError');

    if (!username || !email || !password) {
        if (errorEl) errorEl.textContent = 'Completá todos los campos';
        return false;
    }
    if (password.length < 4) {
        if (errorEl) errorEl.textContent = 'La contraseña debe tener al menos 4 caracteres';
        return false;
    }

    const result = AlephAPI.Auth.register(username, email, password, role);
    if (result.ok) {
        window.location.href = './dashboard.html';
    } else {
        if (errorEl) errorEl.textContent = result.error;
    }
    return false;
}

// ─── LOGOUT ──────────────────────────────────────────────────
function logout() {
    AlephAPI.Auth.logout();
    window.location.href = './index.html';
}

// ─── TABS (login/register) ───────────────────────────────────
function showLogin() {
    document.getElementById('loginForm').style.display = 'flex';
    document.getElementById('registerForm').style.display = 'none';
    document.querySelectorAll('.tab')[0]?.classList.add('active');
    document.querySelectorAll('.tab')[1]?.classList.remove('active');
}

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'flex';
    document.querySelectorAll('.tab')[0]?.classList.remove('active');
    document.querySelectorAll('.tab')[1]?.classList.add('active');
}

// ─── INIT GLOBAL ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Seed datos demo si es primera vez
    AlephAPI.seedDemo();

    // Dark mode siempre
    initDarkMode();

    // Nav activa
    setActiveNav();

    // Página de login
    if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/frontend/')) {
        redirectIfLoggedIn();
        document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
        document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
    }

    // Páginas protegidas
    const protectedPages = ['dashboard', 'tareas', 'horario', 'promedios', 'comunicacion', 'ai-chat'];
    const isProtected = protectedPages.some(p => window.location.pathname.includes(p));
    if (isProtected) {
        const user = requireAuth();
        if (user) renderHeader(user);
    }
});
