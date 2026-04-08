// ============================================================
// AlephOne — ai-chat.js (VERSIÓN PoC SEGURA + DOM READY)
// ============================================================

let conversationHistory = [];
let isLoading = false;
let currentUser = null;
let GEMINI_API_KEY = null; // 1. Definida global pero vacía

const SYSTEM_PROMPT = `...`; // (Tu prompt largo acá)

// ─── GESTIÓN DE API KEY ──────────────────────────────────────
function getApiKey() {
    let key = localStorage.getItem('fractal_gemini_key');
    if (!key) {
        key = prompt('🔑 Fractal AI: Ingresá tu Gemini API Key para comenzar.\n(Se guardará localmente)');
        if (key) {
            key = key.trim();
            localStorage.setItem('fractal_gemini_key', key);
        }
    }
    return key;
}

// ─── UTILIDADES (sanitize, formatText, etc.) ──────────────────
// ... (mantené las funciones que ya tenías)

// ─── ENVÍO DE MENSAJE ────────────────────────────────────────
async function enviarMensaje() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();

    if (!text || isLoading) return;

    // 2. Verificación de la Key antes de disparar el fetch
    if (!GEMINI_API_KEY) {
        GEMINI_API_KEY = getApiKey(); // Re-intento si por alguna razón falló el init
        if (!GEMINI_API_KEY) return; 
    }

    addBubble('user', text);
    input.value = '';
    isLoading = true;
    showTyping();

    try {
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [
                    ...conversationHistory.map(m => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    })),
                    { role: 'user', parts: [{ text: text }] }
                ]
            })
        });

        const data = await response.json();
        hideTyping();

        if (data.error) {
            if (data.error.code === 401 || data.error.message.includes("key")) {
                addBubble('ai', '⚠️ La Key no es válida. Reseteala con localStorage.clear() y refrescá.');
                localStorage.removeItem('fractal_gemini_key');
            } else {
                addBubble('ai', `⚠️ Error: ${data.error.message}`);
            }
            return;
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText) {
            conversationHistory.push({ role: 'user', content: text });
            conversationHistory.push({ role: 'assistant', content: aiText });
            addBubble('ai', aiText);
        }

    } catch (err) {
        hideTyping();
        addBubble('ai', '⚠️ Error de conexión.');
    } finally {
        isLoading = false;
        input.focus();
    }
}

// ─── INICIALIZACIÓN (CORREGIDA) ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // 3. Ahora sí, el prompt sale cuando el navegador terminó de cargar el HTML
    GEMINI_API_KEY = getApiKey();

    if (typeof requireAuth === 'function') currentUser = requireAuth();

    const input = document.getElementById('chatInput');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviarMensaje();
            }
        });
    }

    // Lógica de bienvenida y renderAvatar...
});
