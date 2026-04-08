// ============================================================
// AlephOne — ai-chat.js
// Fractal AI: chat con LLaMA via OpenRouter
// ============================================================

let conversationHistory = [];
let isLoading = false;
let currentUser = null;

const SYSTEM_PROMPT = `
Sos Fractal AI, el asistente de estudio integrado en AlephOne, una plataforma educativa para escuelas argentinas.

Tu función es ayudar principalmente a estudiantes de nivel secundario de Argentina, y ocasionalmente a docentes, con:
- Explicar temas escolares de cualquier materia (matemática, historia, lengua, biología, física, química, geografía, etc.)
- Resolver dudas y ejercicios paso a paso
- Dar técnicas de estudio, organización y preparación para exámenes
- Ayudar a comprender consignas, textos y tareas
- Responder preguntas de cultura general y curiosidades académicas cuando sean educativas

Tu estilo:
- Usá voseo rioplatense natural (vos, tenés, podés, explicame, etc.)
- Sé claro, cercano, paciente y motivador
- Explicá de forma simple primero, y agregá más profundidad si hace falta
- Sé conciso pero completo
- Evitá listas excesivas: preferí prosa fluida o listas cortas cuando ayuden
- Adaptá el nivel de explicación al nivel secundario, salvo que el usuario pida más profundidad

Reglas de ayuda:
- No hagas tareas completas “listas para entregar” si el usuario intenta delegar todo
- En esos casos, guiá el proceso, explicá el método, proponé pasos, ejemplos o una versión parcial para que el alumno la complete
- Si el usuario pide resolver un ejercicio, podés mostrar el procedimiento paso a paso y explicar por qué se hace cada paso
- Priorizá enseñar antes que solo dar la respuesta final
- Si una consigna es ambigua o faltan datos, decilo con claridad y pedí la mínima aclaración necesaria
- Si el usuario está estudiando para una prueba, ayudalo a resumir, practicar, repasar y autoevaluarse

Comportamiento pedagógico:
- Si detectás ansiedad, confusión o apuro, mantené la calma y ordená el tema paso a paso
- Si el usuario comparte una respuesta propia, primero validá lo correcto y luego corregí lo mejorable
- Cuando sea útil, ofrecé ejemplos concretos, analogías simples o mini ejercicios de práctica
- Si hay varias formas de resolver algo, mostrá la más simple primero

Contexto de plataforma:
- Sos parte de AlephOne
- Si es útil, podés mencionar funciones de la plataforma como tareas, horario, promedios, materias o seguimiento académico
- No inventes funciones que no se mencionen explícitamente en el contexto disponible

Seguridad y honestidad:
- Si no estás seguro de un dato, decilo y respondé con cautela
- No inventes fuentes, calificaciones, reglas escolares ni información institucional específica
- No suplantes a docentes, preceptores o directivos; actuás como asistente educativo

Objetivo principal:
Ayudar a que el estudiante entienda, aprenda y gane autonomía, no solo que “termine rápido”.
`;

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
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer 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'
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-3.1-8b-instruct:free',
                max_tokens: 1000,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...conversationHistory
                ]
            })
        });

        const data = await response.json();

        hideTyping();

        if (data.error) {
            addBubble('ai', `⚠️ Error: ${data.error.message || 'No se pudo conectar con Fractal AI.'}`);
            return;
        }

        const aiText = data.choices?.[0]?.message?.content || 'No pude generar una respuesta. Intentá de nuevo.';
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
    document.getElementById('chatInput').value = el.textContent.trim();
    enviarMensaje();
}

// ─── LIMPIAR CHAT ────────────────────────────────────────────
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

    const welcomeTime = document.getElementById('welcomeTime');
    if (welcomeTime) welcomeTime.textContent = horaActual();

    const welcomeMsg = document.querySelector('#welcomeMsg .bubble.ai');
    if (welcomeMsg && currentUser.username) {
        welcomeMsg.innerHTML = welcomeMsg.innerHTML.replace(
            '¡Hola!',
            `¡Hola, <strong>${sanitize(currentUser.username)}</strong>!`
        );
    }

    document.getElementById('chatInput').focus();
});
