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
        window.location.href = './index.html';
        return null;
    }
    return user;
}

function requireRole(role) {
    const user = requireAuth();
    if (!user) return null;
    if (user.role !== role) {
        window.location.href = './dashboard.html';
        return null;
    }
    return user;
}

function redirectIfLoggedIn() {
    const user = AlephAPI.Auth.getCurrentUser();
    if (user) {
        window.location.href = './dashboard.html';
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
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value;
    const errorEl  = document.getElementById('loginError');
    const btn      = e.target.querySelector('button[type="submit"]');

    if (!username || !password) {
        if (errorEl) errorEl.textContent = 'Completá todos los campos';
        return false;
    }

    if (btn) btn.textContent = 'Ingresando...';

    const result = await AlephAPI.Auth.login(username, password);
    if (result.ok) {
        window.location.href = './dashboard.html';
    } else {
        if (errorEl) errorEl.textContent = result.error;
        if (btn) btn.textContent = 'Ingresar →';
    }
    return false;
}

// ─── REGISTER ────────────────────────────────────────────────
async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername')?.value?.trim();
    const email    = document.getElementById('registerEmail')?.value?.trim();
    const password = document.getElementById('registerPassword')?.value;
    const role     = document.getElementById('registerRole')?.value || 'student';
    const errorEl  = document.getElementById('registerError');
    const btn      = e.target.querySelector('button[type="submit"]');

    if (!username || !email || !password) {
        if (errorEl) errorEl.textContent = 'Completá todos los campos';
        return false;
    }
    if (password.length < 6) {
        if (errorEl) errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
        return false;
    }

    // Validación de formato de usuario (letras, números, _ y .)
    const usernameRegex = /^[a-zA-Z0-9_.]{3,26}$/;
    if (!usernameRegex.test(username)) {
        if (errorEl) errorEl.textContent = 'El usuario solo puede tener letras, números, _ y . (3 a 26 caracteres)';
        if (btn) btn.textContent = 'Crear cuenta →';
        return false;
    }

    if (btn) btn.textContent = 'Creando cuenta...';

    const result = await AlephAPI.Auth.register(username, email, password, role);
    if (result.ok) {
        window.location.href = './dashboard.html';
    } else {
        if (errorEl) errorEl.textContent = result.error;
        if (btn) btn.textContent = 'Crear cuenta →';
    }
    return false;
}

// ─── LOGOUT ──────────────────────────────────────────────────
async function logout() {
    await AlephAPI.Auth.logout();
    window.location.href = './index.html';
}

// ============================================================
// ACCESSIBILITY — Global system (runs on every page)
// ============================================================

// ─── SVG FILTERS (inyectados vía JS para que funcionen en todas las páginas) ──
function injectVisionSVGFilters() {
    if (document.getElementById('aleph-vision-filters')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'aleph-vision-filters';
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    svg.innerHTML = `
        <defs>
            <filter id="filter-deuteranopia" color-interpolation-filters="linearRGB">
                <feColorMatrix type="matrix" values="0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0"/>
            </filter>
            <filter id="filter-protanopia" color-interpolation-filters="linearRGB">
                <feColorMatrix type="matrix" values="0.152 1.053 -0.205 0 0  0.115 0.786 0.099 0 0  -0.004 -0.048 1.052 0 0  0 0 0 1 0"/>
            </filter>
            <filter id="filter-tritanopia" color-interpolation-filters="linearRGB">
                <feColorMatrix type="matrix" values="1.256 -0.077 -0.179 0 0  -0.078 0.931 0.148 0 0  0.005 0.691 0.304 0 0  0 0 0 1 0"/>
            </filter>
        </defs>
    `;
    document.body.insertBefore(svg, document.body.firstChild);
}

// ─── FONT SIZE ───────────────────────────────────────────────
const _ALEPH_FONT_SIZES = [85, 92, 100, 107, 115];
let _alephFontSizeIdx = 2;

function initFontSize() {
    const saved = localStorage.getItem('aleph_font_size_idx');
    if (saved !== null) {
        _alephFontSizeIdx = parseInt(saved, 10);
        const size = _ALEPH_FONT_SIZES[_alephFontSizeIdx] || 100;
        document.documentElement.style.fontSize = size + '%';
        // Sync dashboard UI if present
        const el = document.getElementById('fontSizeVal');
        if (el) el.textContent = size + '%';
    }
}

function changeFontSize(dir) {
    _alephFontSizeIdx = Math.max(0, Math.min(_ALEPH_FONT_SIZES.length - 1, _alephFontSizeIdx + dir));
    const size = _ALEPH_FONT_SIZES[_alephFontSizeIdx];
    document.documentElement.style.fontSize = size + '%';
    const el = document.getElementById('fontSizeVal');
    if (el) el.textContent = size + '%';
    localStorage.setItem('aleph_font_size_idx', _alephFontSizeIdx);
}

// ─── VISION MODES ────────────────────────────────────────────
const _ALEPH_VISION_MODES = ['deuteranopia', 'protanopia', 'tritanopia', 'grayscale'];

function setVision(mode) {
    _ALEPH_VISION_MODES.forEach(m => document.body.classList.remove('vision-' + m));
    document.querySelectorAll('.vision-btn').forEach(b => b.classList.remove('active'));
    if (mode !== 'normal') document.body.classList.add('vision-' + mode);
    const id = 'vision' + mode.charAt(0).toUpperCase() + mode.slice(1);
    document.getElementById(id)?.classList.add('active');
    localStorage.setItem('aleph_vision', mode);
}

function initVision() {
    const saved = localStorage.getItem('aleph_vision') || 'normal';
    setVision(saved);
}

// ─── A11Y TOGGLES ────────────────────────────────────────────
const _ALEPH_A11Y_KEYS = [
    'reduce-motion', 'reduce-transparency', 'high-contrast',
    'font-dyslexic', 'letter-spacing-wide', 'line-height-wide',
    'underline-links', 'enhanced-focus', 'large-targets'
];

function toggleA11y(key) {
    const isOn = document.body.classList.toggle(key);
    document.getElementById('sw-' + key)?.classList.toggle('on', isOn);
    document.getElementById('row-' + key)?.setAttribute('aria-checked', String(isOn));
    localStorage.setItem('aleph_a11y_' + key, isOn);
}

function initA11yToggles() {
    _ALEPH_A11Y_KEYS.forEach(key => {
        if (localStorage.getItem('aleph_a11y_' + key) === 'true') {
            document.body.classList.add(key);
            // Sync dashboard settings panel UI if present
            document.getElementById('sw-' + key)?.classList.add('on');
            document.getElementById('row-' + key)?.setAttribute('aria-checked', 'true');
        }
    });
}

// ─── INIT ALL ACCESSIBILITY ──────────────────────────────────
function initAccessibility() {
    injectVisionSVGFilters();
    initFontSize();
    initVision();
    initA11yToggles();
}

// ─── INIT GLOBAL ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Init Supabase auth PRIMERO
    await AlephAPI.Auth.init();

    // Dark mode siempre
    initDarkMode();

    // Accesibilidad global (font size, visión, toggles)
    initAccessibility();

    // Nav activa
    setActiveNav();

    // Lógica específica de la página de Auth (Index)
    const isIndex = window.location.pathname.includes('index.html') || 
                    window.location.pathname.endsWith('/frontend/') || 
                    window.location.pathname.endsWith('/');

    if (isIndex) {
        redirectIfLoggedIn();
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm) loginForm.addEventListener('submit', handleLogin);
        if (registerForm) registerForm.addEventListener('submit', handleRegister);
        return;
    }

    // Páginas protegidas
    const protectedPages = ['dashboard', 'tareas', 'horario', 'promedios', 'comunicacion', 'ai-chat', 'quizzit'];
    const isProtected = protectedPages.some(p => window.location.pathname.includes(p));
    
    if (isProtected) {
        const user = requireAuth();
        if (user) renderHeader(user);
    }
});
