// ============================================================
// AlephOne — ai-chat.js
// Fractal AI: chat con Gemini 1.5 Flash (Versión Estable)
// ============================================================

let conversationHistory = [];
let isLoading = false;
let currentUser = null;

// REEMPLAZÁ CON TU CLAVE
const GEMINI_API_KEY = 'TU_KEY_ACÁ'; 

const SYSTEM_PROMPT = `
Sos Fractal AI, el asistente de estudio integrado en AlephOne, una plataforma educativa para escuelas argentinas.
Tu función es ayudar a estudiantes de nivel secundario de Argentina. 
Usá voseo rioplatense (vos, tenés, podés). 
Sé claro, paciente y no resuelvas la tarea completa: guiá al alumno.
`;

// ─── UTILIDADES ──────────────────────────────────────────────
function horaActual() {
    return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    const el = document.getElementById('chatMessages');
    if (el) el.scrollTop = el.scrollHeight;
}

// ─── UI: BURBUJAS ───────────────────────────────────────────
function addBubble(role, text, animate = true) {
    const container = document.getElementById('chatMessages');
    const isAI = role === 'ai';

    const row = document.createElement('div');
    row.className = `msg-row ${role}${animate ? ' fade-up' : ''}`;

    const avatarText = isAI ? 'ℵ' : (currentUser?.username?.charAt(0).toUpperCase() || 'U');

    row.innerHTML = `
        <div class="msg-avatar ${role}">${avatarText}</div>
        <div class="bubble ${role}">
            ${formatText(text)}
            <span class="bubble-time">${horaActual()}</span>
        </div>`;

    container.appendChild(row);
    scrollToBottom();
    return row;
}

function formatText(text) {
    return sanitize(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

function showTyping() {
    const container = document.getElementById('chatMessages');
    const row = document.createElement('div');
    row.className = 'msg-row ai';
    row.id = 'typingRow';
    row.innerHTML = `
        <div class="msg-avatar ai">ℵ</div>
        <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>`;
    container.appendChild(row);
    scrollToBottom();
}

function hideTyping() {
    document.getElementById('typingRow')?.remove();
}

// ─── LOGICA DE ENVÍO (SOLUCIÓN COMPLETA) ─────────────────────
async function enviarMensaje() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const text = input.value.trim();

    if (!text || isLoading) return;

    // 1. UI: Mostrar mensaje del usuario y limpiar input
    addBubble('user', text);
    const sugg = document.getElementById('suggestions');
    if (sugg) sugg.style.display = 'none';

    input.value = '';
    input.style.height = 'auto';
    isLoading = true;
    sendBtn.disabled = true;
    showTyping();

    // 2. TIMEOUT: Abortar si la API tarda más de 20 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
        // 3. MODELO: Usamos 1.5-flash para mayor estabilidad en Free Tier
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [
                    ...conversationHistory.map(m => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    })),
                    { role: 'user', parts: [{ text: text }] }
                ],
                generationConfig: {
                    maxOutputTokens: 1000,
                    temperature: 0.7
                }
            })
        });

        clearTimeout(timeoutId);
        const data = await response.json();
        hideTyping();

        // 4. MANEJO DE ERRORES DE CUOTA
        if (data.error) {
            console.error("Gemini Error:", data.error);
            if (data.error.code === 429) {
                addBubble('ai', '⚠️ El servidor está saturado. Aguantame un minuto y volvé a probar.');
            } else {
                addBubble('ai', `⚠️ Error: ${data.error.message || 'No pude generar la respuesta.'}`);
            }
            return;
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (aiText) {
            // 5. HISTORIAL: Solo guardamos si la respuesta fue exitosa
            conversationHistory.push({ role: 'user', content: text });
            conversationHistory.push({ role: 'assistant', content: aiText });
            addBubble('ai', aiText);
        } else {
            addBubble('ai', 'No recibí contenido de la IA. Intentá de nuevo.');
        }

    } catch (err) {
        hideTyping();
        if (err.name === 'AbortError') {
            addBubble('ai', '⚠️ La conexión tardó demasiado. Probá de nuevo.');
        } else {
            console.error('Fractal AI error:', err);
            addBubble('ai', '⚠️ No se pudo conectar con Fractal AI. Verificá tu internet.');
        }
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

// ─── FUNCIONES ADICIONALES ──────────────────────────────────
function enviarSugerencia(el) {
    document.getElementById('chatInput').value = el.textContent.trim();
    enviarMensaje();
}

function limpiarChat() {
    if (conversationHistory.length > 0 && !confirm('¿Limpiar la conversación?')) return;
    conversationHistory = [];
    const container = document.getElementById('chatMessages');
    while (container.children.length > 1) {
        container.removeChild(container.lastChild);
    }
    const sugg = document.getElementById('suggestions');
    if (sugg) sugg.style.display = 'flex';
}

function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarMensaje();
    }
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function renderAvatar(user) {
    const el = document.getElementById('userAvatar');
    if (el) el.textContent = user.username.charAt(0).toUpperCase();
    const roleEl = document.getElementById('userRole');
    if (roleEl) {
        const roles = { student: 'Estudiante', teacher: 'Docente', director: 'Director' };
        roleEl.textContent = roles[user.role] || user.role;
        roleEl.className = `role-badge ${user.role}`;
    }
}

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    currentUser = requireAuth(); // Asume que requireAuth está en app.js
    if (!currentUser) return;

    renderAvatar(currentUser);
    document.getElementById('chatInput')?.addEventListener('keydown', handleKey);
    document.getElementById('chatInput')?.addEventListener('input', (e) => autoResize(e.target));
    document.getElementById('chatInput')?.focus();
    
    // Rellenar nombre en bienvenida
    const welcomeMsg = document.querySelector('#welcomeMsg .bubble.ai');
    if (welcomeMsg && currentUser.username) {
        welcomeMsg.innerHTML = welcomeMsg.innerHTML.replace('¡Hola!', `¡Hola, <strong>${sanitize(currentUser.username)}</strong>!`);
    }
});
