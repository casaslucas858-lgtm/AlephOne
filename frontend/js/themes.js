// ============================================================
// AlephOne — themes.js
// Sistema de temas, visión de color y accesibilidad
// Cargar ANTES de dashboard.js
// ============================================================

// ─── CONSTANTES ──────────────────────────────────────────────
const ALEPH_THEMES = [
    { id: 'dark',       label: 'Dark' },
    { id: 'light',      label: 'Light' },
    { id: 'grey',       label: 'Grey' },
    { id: 'azure',      label: 'Azure' },
    { id: 'pink',       label: 'Pink' },
    { id: 'andromeda',  label: 'Andromeda' },
    { id: 'red',        label: 'Red' },
    { id: 'green',      label: 'Green' }
];

const ALEPH_THEME_MODES = [
    { id: '',      label: 'Auto' },
    { id: 'light', label: 'Claro' },
    { id: 'dark',  label: 'Oscuro' }
];

const ALEPH_TEXT_SIZES = [
    { id: 'xs',  label: 'XS',   value: 85  },
    { id: 'sm',  label: 'S',    value: 92  },
    { id: 'md',  label: 'M',    value: 100 },
    { id: 'lg',  label: 'L',    value: 107 },
    { id: 'xl',  label: 'XL',   value: 115 }
];

const ALEPH_COLOR_VISION_MODES = [
    { id: 'normal',        label: 'Normal' },
    { id: 'deuteranopia',  label: 'Deuteranopia' },
    { id: 'protanopia',    label: 'Protanopia' },
    { id: 'tritanopia',    label: 'Tritanopia' },
    { id: 'grayscale',     label: 'Escala de grises' }
];

const ALEPH_ACCESSIBILITY_OPTIONS = [
    { id: 'reduceMotion',        label: 'Reducir movimiento',       bodyClass: 'reduce-motion' },
    { id: 'reduceTransparency',  label: 'Reducir transparencias',   bodyClass: 'reduce-transparency' },
    { id: 'highContrast',        label: 'Alto contraste',           bodyClass: 'high-contrast' },
    { id: 'fontDyslexic',        label: 'Fuente para dislexia',     bodyClass: 'font-dyslexic' },
    { id: 'letterSpacing',       label: 'Espaciado de letras',      bodyClass: 'letter-spacing-wide' },
    { id: 'lineHeight',          label: 'Interlineado amplio',      bodyClass: 'line-height-wide' },
    { id: 'underlineLinks',      label: 'Subrayar links',           bodyClass: 'underline-links' },
    { id: 'enhancedFocus',       label: 'Focus visible mejorado',   bodyClass: 'enhanced-focus' },
    { id: 'largeTargets',        label: 'Área de toque ampliada',   bodyClass: 'large-targets' }
];

// ─── DARK THEMES ─────────────────────────────────────────────
const ALEPH_DARK_THEMES = new Set(['dark', 'andromeda']);

// ─── STORAGE KEYS ────────────────────────────────────────────
const SK = {
    theme:       'aleph_theme',
    themeMode:   'aleph_theme_mode',
    textSize:    'aleph_text_size',
    colorVision: 'aleph_vision',
    a11y:        'aleph_a11y'
};

// ─── GETTERS ─────────────────────────────────────────────────
function getStoredTheme() {
    return localStorage.getItem(SK.theme) || 'dark';
}

function getStoredThemeMode() {
    return localStorage.getItem(SK.themeMode) || '';
}

function getAccessibilitySettings() {
    const raw = localStorage.getItem(SK.a11y);
    const base = {
        textSize:    localStorage.getItem(SK.textSize) || 'md',
        colorVision: localStorage.getItem(SK.colorVision) || 'normal'
    };
    try {
        return { ...base, ...(raw ? JSON.parse(raw) : {}) };
    } catch {
        return base;
    }
}

function _saveA11ySettings(settings) {
    const { textSize, colorVision, ...rest } = settings;
    localStorage.setItem(SK.a11y, JSON.stringify(rest));
}

// ─── TEMA ─────────────────────────────────────────────────────
function applyTheme(themeId) {
    // Quitar todas las clases de tema
    ALEPH_THEMES.forEach(t => document.body.classList.remove('theme-' + t.id));
    document.body.classList.remove('dark-mode');

    document.body.classList.add('theme-' + themeId);

    // dark-mode para compatibilidad con el CSS existente
    if (ALEPH_DARK_THEMES.has(themeId)) {
        document.body.classList.add('dark-mode');
    }

    localStorage.setItem(SK.theme, themeId);

    // Actualizar botón topbar si existe
    const darkBtn = document.getElementById('darkModeBtn');
    if (darkBtn) {
        darkBtn.textContent = ALEPH_DARK_THEMES.has(themeId) ? '☀️' : '🌙';
    }

    // Disparar evento
    document.dispatchEvent(new CustomEvent('aleph:themechange', {
        detail: { theme: themeId, mode: getStoredThemeMode() }
    }));
}

function setThemeMode(modeId) {
    localStorage.setItem(SK.themeMode, modeId);

    // Aplicar modo sobre el tema actual
    const current = getStoredTheme();
    if (modeId === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (modeId === 'light') {
        document.body.classList.remove('dark-mode');
    } else {
        // auto — respetar preferencia del sistema
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.toggle('dark-mode', prefersDark || ALEPH_DARK_THEMES.has(current));
    }

    document.dispatchEvent(new CustomEvent('aleph:thememodechange', {
        detail: { mode: modeId }
    }));
}

// ─── TAMAÑO DE TEXTO ─────────────────────────────────────────
function setTextSize(sizeId) {
    const size = ALEPH_TEXT_SIZES.find(s => s.id === sizeId);
    if (!size) return;

    document.documentElement.style.fontSize = size.value + '%';
    localStorage.setItem(SK.textSize, sizeId);

    const settings = getAccessibilitySettings();
    settings.textSize = sizeId;
    _saveA11ySettings(settings);

    document.dispatchEvent(new CustomEvent('aleph:accessibilitychange', {
        detail: { settings: getAccessibilitySettings() }
    }));
}

// ─── VISIÓN DE COLOR ─────────────────────────────────────────
const VISION_CLASSES = ALEPH_COLOR_VISION_MODES
    .filter(m => m.id !== 'normal')
    .map(m => 'vision-' + m.id);

function setColorVisionMode(modeId) {
    VISION_CLASSES.forEach(c => document.body.classList.remove(c));

    if (modeId !== 'normal') {
        document.body.classList.add('vision-' + modeId);
    }

    localStorage.setItem(SK.colorVision, modeId);

    document.dispatchEvent(new CustomEvent('aleph:accessibilitychange', {
        detail: { settings: getAccessibilitySettings() }
    }));
}

// ─── OPCIONES DE ACCESIBILIDAD ───────────────────────────────
function setAccessibilityOption(optionId, value) {
    const option = ALEPH_ACCESSIBILITY_OPTIONS.find(o => o.id === optionId);
    if (!option) return;

    document.body.classList.toggle(option.bodyClass, value);

    const settings = getAccessibilitySettings();
    settings[optionId] = value;
    _saveA11ySettings(settings);

    document.dispatchEvent(new CustomEvent('aleph:accessibilitychange', {
        detail: { settings: getAccessibilitySettings() }
    }));
}

// ─── INIT — aplica todo al cargar ────────────────────────────
function initAlephThemes() {
    const theme      = getStoredTheme();
    const mode       = getStoredThemeMode();
    const settings   = getAccessibilitySettings();

    // Tema
    ALEPH_THEMES.forEach(t => document.body.classList.remove('theme-' + t.id));
    document.body.classList.add('theme-' + theme);
    if (ALEPH_DARK_THEMES.has(theme)) document.body.classList.add('dark-mode');

    // Modo sobre tema
    if (mode === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (mode === 'light') {
        document.body.classList.remove('dark-mode');
    } else if (mode === '') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark && !ALEPH_DARK_THEMES.has(theme)) {
            document.body.classList.add('dark-mode');
        }
    }

    // Tamaño de texto
    const size = ALEPH_TEXT_SIZES.find(s => s.id === settings.textSize) ||
                 ALEPH_TEXT_SIZES.find(s => s.id === 'md');
    if (size) document.documentElement.style.fontSize = size.value + '%';

    // Visión de color
    VISION_CLASSES.forEach(c => document.body.classList.remove(c));
    if (settings.colorVision && settings.colorVision !== 'normal') {
        document.body.classList.add('vision-' + settings.colorVision);
    }

    // Opciones de accesibilidad
    ALEPH_ACCESSIBILITY_OPTIONS.forEach(option => {
        document.body.classList.toggle(option.bodyClass, Boolean(settings[option.id]));
    });
}

// Ejecutar lo antes posible para evitar flash
initAlephThemes();
