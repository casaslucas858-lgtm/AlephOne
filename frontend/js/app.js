// ============================================================
// AlephProject — app.js
// Core: auth, routing, utilidades globales, themes
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

// ─── THEMES ─────────────────────────────────────────────────
const ALEPH_THEMES = [
    { id: 'dark',      label: 'Dark',      dark: true },
    { id: 'light',     label: 'Light',     dark: false },
    { id: 'grey',      label: 'Grey',      dark: false },
    { id: 'azure',     label: 'Azure',     dark: false },
    { id: 'pink',      label: 'Pink',      dark: false },
    { id: 'andromeda', label: 'Andromeda', dark: true },
    { id: 'red',       label: 'Red',       dark: false },
    { id: 'green',     label: 'Green',     dark: false }
];

const ALEPH_THEME_MODES = [
    { id: 'light', label: 'Claro' },
    { id: 'dark',  label: 'Oscuro' },
    { id: 'auto',  label: 'Auto' }
];

const ALEPH_TEXT_SIZES = [
    { id: '85',   label: '85%',    className: 'a11y-text-85' },
    { id: '92_5', label: '92.5%',  className: 'a11y-text-92-5' },
    { id: '100',  label: '100%',   className: 'a11y-text-100' },
    { id: '107_5', label: '107.5%', className: 'a11y-text-107-5' },
    { id: '115',  label: '115%',   className: 'a11y-text-115' }
];

const ALEPH_COLOR_VISION_MODES = [
    { id: 'normal',      label: 'Normal',      className: '' },
    { id: 'deuteranopia', label: 'Deuteranopia', className: 'a11y-color-deuteranopia' },
    { id: 'protanopia',  label: 'Protanopia',  className: 'a11y-color-protanopia' },
    { id: 'tritanopia',  label: 'Tritanopia',  className: 'a11y-color-tritanopia' },
    { id: 'grayscale',   label: 'Escala de grises', className: 'a11y-color-grayscale' }
];

const ALEPH_ACCESSIBILITY_OPTIONS = [
    { id: 'reducedMotion',       label: 'Reducir movimiento',          className: 'a11y-reduced-motion' },
    { id: 'reducedTransparency', label: 'Reducir transparencias',      className: 'a11y-reduced-transparency' },
    { id: 'highContrast',        label: 'Alto contraste',              className: 'a11y-high-contrast' },
    { id: 'dyslexiaFont',        label: 'Fuente para dislexia',        className: 'a11y-dyslexia-font' },
    { id: 'letterSpacing',       label: 'Espaciado de letras',         className: 'a11y-letter-spacing' },
    { id: 'wideLineHeight',      label: 'Interlineado amplio',         className: 'a11y-wide-line-height' },
    { id: 'underlineLinks',      label: 'Subrayar links',              className: 'a11y-underline-links' },
    { id: 'enhancedFocus',       label: 'Focus visible mejorado',      className: 'a11y-enhanced-focus' },
    { id: 'largeTouchTargets',   label: 'Área de toque ampliada',      className: 'a11y-large-touch' }
];

const ALEPH_ACCESSIBILITY_DEFAULTS = {
    colorVision: 'normal',
    textSize: '100',
    reducedMotion: false,
    reducedTransparency: false,
    highContrast: false,
    dyslexiaFont: false,
    letterSpacing: false,
    wideLineHeight: false,
    underlineLinks: false,
    enhancedFocus: false,
    largeTouchTargets: false
};

function getStoredThemeMode() {
    const mode = localStorage.getItem('aleph_theme_mode');
    return ALEPH_THEME_MODES.some(item => item.id === mode) ? mode : '';
}

function resolveThemeMode(mode) {
    if (mode === 'auto') {
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode === 'light' || mode === 'dark' ? mode : '';
}

function getStoredTheme() {
    const modeTheme = resolveThemeMode(getStoredThemeMode());
    if (modeTheme) return modeTheme;

    const savedTheme = localStorage.getItem('aleph_theme');
    if (ALEPH_THEMES.some(theme => theme.id === savedTheme)) return savedTheme;

    const legacyDarkMode = localStorage.getItem('aleph_dark_mode');
    if (legacyDarkMode === 'true') return 'dark';
    if (legacyDarkMode === 'false') return 'light';

    return 'dark';
}

function applyTheme(themeId, options = {}) {
    const selectedTheme = ALEPH_THEMES.find(theme => theme.id === themeId) || ALEPH_THEMES[0];

    ALEPH_THEMES.forEach(theme => {
        document.body.classList.remove(`theme-${theme.id}`);
    });
    document.body.classList.add(`theme-${selectedTheme.id}`);
    document.body.classList.toggle('dark-mode', selectedTheme.dark);
    document.documentElement.dataset.theme = selectedTheme.id;

    localStorage.setItem('aleph_theme', selectedTheme.id);
    localStorage.setItem('aleph_dark_mode', selectedTheme.dark ? 'true' : 'false');
    if (!options.fromMode) {
        localStorage.setItem('aleph_theme_mode',
            selectedTheme.id === 'light' || selectedTheme.id === 'dark' ? selectedTheme.id : 'custom'
        );
    }

    const selector = document.getElementById('darkModeBtn') || document.getElementById('themeBtn');
    if (selector) selector.value = selectedTheme.id;

    document.dispatchEvent(new CustomEvent('aleph:themechange', {
        detail: { theme: selectedTheme.id, mode: getStoredThemeMode() }
    }));
}

function setThemeMode(mode) {
    if (!ALEPH_THEME_MODES.some(item => item.id === mode)) return;

    localStorage.setItem('aleph_theme_mode', mode);
    applyTheme(resolveThemeMode(mode), { fromMode: true });
    document.dispatchEvent(new CustomEvent('aleph:thememodechange', {
        detail: { mode }
    }));
}

function createThemeSelector(existingControl) {
    if (!existingControl) return null;
    if (existingControl.tagName === 'SELECT') return existingControl;

    const selector = document.createElement('select');
    selector.id = existingControl.id;
    selector.className = `${existingControl.className} theme-select`.trim();
    selector.title = existingControl.title || 'Cambiar tema';
    selector.setAttribute('aria-label', selector.title);

    ALEPH_THEMES.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.id;
        option.textContent = theme.label;
        selector.appendChild(option);
    });

    existingControl.replaceWith(selector);
    return selector;
}

function initThemes() {
    const selector = createThemeSelector(
        document.getElementById('darkModeBtn') || document.getElementById('themeBtn')
    );
    const storedMode = getStoredThemeMode();
    const selectedTheme = getStoredTheme();
    applyTheme(selectedTheme, { fromMode: Boolean(storedMode) });

    if (selector) {
        selector.value = selectedTheme;
        selector.addEventListener('change', event => applyTheme(event.target.value));
    }

    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        if (getStoredThemeMode() === 'auto') setThemeMode('auto');
    });
}

function initDarkMode() {
    initThemes();
}

function toggleDarkMode() {
    const currentTheme = getStoredTheme();
    setThemeMode(currentTheme === 'dark' ? 'light' : 'dark');
}

function getAccessibilitySettings() {
    try {
        return {
            ...ALEPH_ACCESSIBILITY_DEFAULTS,
            ...JSON.parse(localStorage.getItem('aleph_accessibility') || '{}')
        };
    } catch {
        return { ...ALEPH_ACCESSIBILITY_DEFAULTS };
    }
}

function applyAccessibility(settings = getAccessibilitySettings()) {
    const normalizedSettings = { ...ALEPH_ACCESSIBILITY_DEFAULTS, ...settings };

    ALEPH_ACCESSIBILITY_OPTIONS.forEach(option => {
        document.body.classList.toggle(option.className, Boolean(normalizedSettings[option.id]));
    });

    ALEPH_COLOR_VISION_MODES.forEach(mode => {
        if (mode.className) document.body.classList.remove(mode.className);
    });
    const colorVision = ALEPH_COLOR_VISION_MODES.find(mode => mode.id === normalizedSettings.colorVision) || ALEPH_COLOR_VISION_MODES[0];
    if (colorVision.className) document.body.classList.add(colorVision.className);

    ALEPH_TEXT_SIZES.forEach(size => document.body.classList.remove(size.className));
    const textSize = ALEPH_TEXT_SIZES.find(size => size.id === normalizedSettings.textSize) || ALEPH_TEXT_SIZES[2];
    document.body.classList.add(textSize.className);

    localStorage.setItem('aleph_accessibility', JSON.stringify(normalizedSettings));

    document.dispatchEvent(new CustomEvent('aleph:accessibilitychange', {
        detail: { settings: normalizedSettings }
    }));
}

function setAccessibilityOption(optionId, enabled) {
    const settings = getAccessibilitySettings();
    settings[optionId] = Boolean(enabled);
    applyAccessibility(settings);
}

function setColorVisionMode(modeId) {
    const settings = getAccessibilitySettings();
    settings.colorVision = ALEPH_COLOR_VISION_MODES.some(mode => mode.id === modeId) ? modeId : 'normal';
    applyAccessibility(settings);
}

function setTextSize(sizeId) {
    const settings = getAccessibilitySettings();
    settings.textSize = ALEPH_TEXT_SIZES.some(size => size.id === sizeId) ? sizeId : '100';
    applyAccessibility(settings);
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

// ─── INIT GLOBAL ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await AlephAPI.Auth.init();

    // Selector de temas siempre
    initDarkMode();
    applyAccessibility();

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
    const protectedPages = ['dashboard', 'tareas', 'horario', 'promedios', 'comunicacion', 'ai-chat', 'schools', 'school-dash', 'school-director'];
    const isProtected = protectedPages.some(p => window.location.pathname.includes(p));
    
    if (isProtected) {
        const user = requireAuth();
        if (user) renderHeader(user);
    }
});
