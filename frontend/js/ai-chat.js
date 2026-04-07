// ============================================================
// AlephOne — ai-chat.js
// Fractal AI: chat con Claude via Anthropic API
// ============================================================

let conversationHistory = [];
let isLoading = false;
let currentUser = null;

const SYSTEM_PROMPT = `Sos Fractal AI, el asistente de estudio integrado en AlephOne, una plataforma educativa para escuelas argentinas.

Tu rol es ayudar a estudiantes de nivel secundario (y ocasionalmente docentes) con:
- Explicar temas de cualquier materia escolar (matemática, historia, lengua, ciencias, etc.)
- Resolver dudas y ejercicios paso a paso
- Dar técnicas de estudio y organización
- Preparar para exámenes
- Responder preguntas de cultura general y curiosidades académicas

Tono: cercano, claro y motivador. Usá el voseo rioplatense (vos, tenés, podés). Sé conciso pero completo. No uses bullet points excesivos — preferí prosa fluida o listas cortas cuando sea necesario.

Limitaciones claras: no hacés tareas completas por el alumno, sino que guiás y explicás. Si alguien pide que hagas toda su tarea, ofrecé explicar el método.

Sos parte de AlephOne — podés mencionar funciones de la plataforma si es relevante (tareas, horario, promedios).`;

// ─── HORA ACTUAL ────────────────────────────────────────────
function horaActual() {
    return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// ─── SCROLL AL FONDO ────────────────────────────────────────
function scrollToBottom() {
    const el = document.getElementById('chatMessages');
    el.scrollTop = el.scrollHeight;
}

// ─── AGREGAR BURBUJA ────────────────────────────────────────
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

// ─── FORMATO BÁSICO DE TEXTO ─────────────────────────────────
function formatText(text) {
    return sanitize(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

// ─── TYPING INDICATOR ───────────────────────────────────────
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

// ─── ENVIAR MENSAJE ──────────────────────────────────────────
async function enviarMensaje() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const text = input.value.trim();

    if (!text || isLoading) return;

    // Ocultar sugerencias tras primer mensaje
    const sugg = document.getElementById('suggestions');
    if (sugg) sugg.style.display = 'none';

    // Mostrar burbuja del usuario
    addBubble('user', text);
    conversationHistory.push({ role: 'user', content: text });

    input.value = '';
    input.style.height = 'auto';
    isLoading = true;
    sendBtn.disabled = true;

    showTyping();

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                system: SYSTEM_PROMPT,
                messages: conversationHistory
            })
        });

        const data = await response.json();

        hideTyping();

        if (data.error) {
            addBubble('ai', `⚠️ Error: ${data.error.message || 'No se pudo conectar con Fractal AI.'}`);
            return;
        }

        const aiText = data.content?.[0]?.text || 'No pude generar una respuesta. Intentá de nuevo.';
        conversationHistory.push({ role: 'assistant', content: aiText });
        addBubble('ai', aiText);

    } catch (err) {
        hideTyping();
        console.error('Fractal AI error:', err);
        addBubble('ai', '⚠️ No se pudo conectar con Fractal AI. Verificá tu conexión e intentá de nuevo.');
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

// ─── SUGERENCIAS RÁPIDAS ────────────────────────────────────
function enviarSugerencia(el) {
    const text = el.textContent.replace(/^[^\s]+\s/, '').trim(); // Sacar emoji
    document.getElementById('chatInput').value = el.textContent.trim();
    enviarMensaje();
}

// ─── LIMPIAR CHAT ────────────────────────────────────────────
function limpiarChat() {
    if (conversationHistory.length > 0 && !confirm('¿Limpiar la conversación?')) return;

    conversationHistory = [];

    const container = document.getElementById('chatMessages');
    // Dejar solo el mensaje de bienvenida
    while (container.children.length > 1) {
        container.removeChild(container.lastChild);
    }

    // Mostrar sugerencias de nuevo
    const sugg = document.getElementById('suggestions');
    if (sugg) sugg.style.display = 'flex';
}

// ─── KEYBOARD ────────────────────────────────────────────────
function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarMensaje();
    }
}

// ─── AUTO RESIZE TEXTAREA ────────────────────────────────────
function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ─── AVATAR / HEADER ────────────────────────────────────────
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

function toggleMobileNav() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    currentUser = requireAuth();
    if (!currentUser) return;

    renderAvatar(currentUser);

    // Hora en mensaje de bienvenida
    const welcomeTime = document.getElementById('welcomeTime');
    if (welcomeTime) welcomeTime.textContent = horaActual();

    // Personalizar saludo si hay nombre
    const welcomeMsg = document.querySelector('#welcomeMsg .bubble.ai');
    if (welcomeMsg && currentUser.username) {
        welcomeMsg.innerHTML = welcomeMsg.innerHTML.replace(
            '¡Hola!',
            `¡Hola, <strong>${sanitize(currentUser.username)}</strong>!`
        );
    }

    document.getElementById('chatInput').focus();
});
