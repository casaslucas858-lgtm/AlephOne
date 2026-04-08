// ============================================================
// AlephOne — ai-chat.js
// Fractal AI: motor estable con Gemini 1.5 Flash (v1)
// ============================================================

let conversationHistory = [];
let isLoading = false;
let currentUser = null;

// REEMPLAZÁ CON TU API KEY DE GOOGLE AI STUDIO
const GEMINI_API_KEY = 'AIzaSyCK1C3mkm9xG2tZGATxDLGBSnkWZkmOB5Q'; 

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

// ─── UTILIDADES DE UI ───────────────────────────────────────
function horaActual() {
    return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    const el = document.getElementById('chatMessages');
    if (el) el.scrollTop = el.scrollHeight;
}

function sanitize(text) {
    if (!text) return '';
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
}

// ─── BURBUJAS Y FORMATO ─────────────────────────────────────
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

// ─── LÓGICA DE ENVÍO Y API ──────────────────────────────────
async function enviarMensaje() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const text = input.value.trim();

    if (!text || isLoading) return;

    // UI Inicial
    addBubble('user', text);
    const sugg = document.getElementById('suggestions');
    if (sugg) sugg.style.display = 'none';

    input.value = '';
    input.style.height = 'auto';
    isLoading = true;
    sendBtn.disabled = true;
    showTyping();

    // Controlador para abortar si la conexión se cuelga (20 seg)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
        // ENDPOINT V1: La versión estable de producción
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(url, {
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

        // Manejo de errores de API
        if (data.error) {
            console.error("Error de Gemini:", data.error);
            if (data.error.code === 429) {
                addBubble('ai', '⚠️ El servidor está a full. Esperá un minutito y volvé a intentar.');
            } else {
                addBubble('ai', `⚠️ Error técnico: ${data.error.message}`);
            }
            return;
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (aiText) {
            // Guardamos en historial solo si la respuesta fue exitosa
            conversationHistory.push({ role: 'user', content: text });
            conversationHistory.push({ role: 'assistant', content: aiText });
            addBubble('ai', aiText);
        } else {
            addBubble('ai', 'Fractal AI no pudo generar contenido. Intentá reformular tu duda.');
        }

    } catch (err) {
        hideTyping();
        if (err.name === 'AbortError') {
            addBubble('ai', '⚠️ La conexión tardó demasiado. ¿Tenés buen internet ahí?');
        } else {
            console.error('Error fatal:', err);
            addBubble('ai', '⚠️ Hubo un problema al conectar. Revisá la consola.');
        }
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

// ─── EVENTOS Y CONTROLADORES ────────────────────────────────
function enviarSugerencia(el) {
    document.getElementById('chatInput').value = el.textContent.trim();
    enviarMensaje();
}

function limpiarChat() {
    if (conversationHistory.length > 0 && confirm('¿Borrar toda la charla?')) {
        conversationHistory = [];
        const container = document.getElementById('chatMessages');
        while (container.children.length > 1) {
            container.removeChild(container.lastChild);
        }
        const sugg = document.getElementById('suggestions');
        if (sugg) sugg.style.display = 'flex';
    }
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

// ─── INICIALIZACIÓN ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // currentUser se obtiene de app.js (requireAuth)
    if (typeof requireAuth === 'function') {
        currentUser = requireAuth();
    }
    
    if (currentUser) {
        renderAvatar(currentUser);
        // Personalizar bienvenida
        const welcomeMsg = document.querySelector('#welcomeMsg .bubble.ai');
        if (welcomeMsg) {
            welcomeMsg.innerHTML = welcomeMsg.innerHTML.replace('¡Hola!', `¡Hola, <strong>${sanitize(currentUser.username)}</strong>!`);
        }
    }

    const input = document.getElementById('chatInput');
    if (input) {
        input.addEventListener('keydown', handleKey);
        input.addEventListener('input', (e) => autoResize(e.target));
        input.focus();
    }

    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) clearBtn.addEventListener('click', limpiarChat);
    
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.addEventListener('click', enviarMensaje);
});
