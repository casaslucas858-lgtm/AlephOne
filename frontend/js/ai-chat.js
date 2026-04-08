// ============================================================
// AlephOne — ai-chat.js (VERSIÓN FINAL POC SEGURA)
// Fractal AI: Motor estable con Gemini 1.5 Flash (v1)
// ============================================================

let conversationHistory = [];
let isLoading = false;
let currentUser = null;
let GEMINI_API_KEY = null; // Definida global para acceso desde enviarMensaje()

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

// ─── GESTIÓN DE API KEY (LocalStorage) ──────────────────────
function getApiKey() {
    let key = localStorage.getItem('fractal_gemini_key');
    if (!key) {
        key = prompt('🔑 Fractal AI: Ingresá tu Gemini API Key para comenzar.\n(Se guardará localmente en tu navegador)');
        if (key) {
            key = key.trim();
            localStorage.setItem('fractal_gemini_key', key);
        }
    }
    return key;
}

// ─── UTILIDADES DE UI ───────────────────────────────────────
function horaActual() {
    return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function sanitize(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatText(text) {
    return sanitize(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

// ─── MANEJO DE BURBUJAS ──────────────────────────────────────
function addBubble(role, text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = `msg-row ${role} fade-up`;
    
    const avatar = role === 'ai' ? 'ℵ' : (currentUser?.username?.charAt(0).toUpperCase() || 'U');

    row.innerHTML = `
        <div class="msg-avatar ${role}">${avatar}</div>
        <div class="bubble ${role}">
            ${formatText(text)}
            <span class="bubble-time">${horaActual()}</span>
        </div>`;
    
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}

function showTyping() {
    const container = document.getElementById('chatMessages');
    const row = document.createElement('div');
    row.className = 'msg-row ai';
    row.id = 'typingRow';
    row.innerHTML = `
        <div class="msg-avatar ai">ℵ</div>
        <div class="typing-dots">
            <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
        </div>`;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}

function hideTyping() {
    document.getElementById('typingRow')?.remove();
}

// ─── LÓGICA DE ENVÍO (API) ───────────────────────────────────
async function enviarMensaje() {
    const input = document.getElementById('chatInput');
    const text = input.value?.trim();

    if (!text || isLoading) return;

    // Verificación de Key antes de disparar
    if (!GEMINI_API_KEY) {
        GEMINI_API_KEY = getApiKey();
        if (!GEMINI_API_KEY) return;
    }

    addBubble('user', text);
    input.value = '';
    input.style.height = 'auto'; // Resetear altura tras enviar
    isLoading = true;
    showTyping();

    try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
            console.error("Error API:", data.error);
            if (data.error.code === 401 || data.error.message.toLowerCase().includes("key")) {
                addBubble('ai', '⚠️ La Key parece inválida. Borrala con localStorage.removeItem("fractal_gemini_key") y refrescá.');
                localStorage.removeItem('fractal_gemini_key');
                GEMINI_API_KEY = null;
            } else if (data.error.code === 429) {
                addBubble('ai', '⚠️ Límite de mensajes alcanzado. Esperá un minuto.');
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
        addBubble('ai', '⚠️ No se pudo conectar con Fractal AI.');
    } finally {
        isLoading = false;
        if (input) input.focus();
    }
}

// ─── INICIALIZACIÓN ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener Key globalmente tras carga de DOM
    GEMINI_API_KEY = getApiKey();

    if (typeof requireAuth === 'function') {
        currentUser = requireAuth();
    }

    const input = document.getElementById('chatInput');
    if (input) {
        // 2. Manejo de Enter para enviar
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviarMensaje();
            }
        });

        // 3. Auto-Resize dinámico
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });

        input.focus();
    }

    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', enviarMensaje);
    }

    // Bienvenida personalizada
    const welcomeMsg = document.querySelector('#welcomeMsg .bubble.ai');
    if (welcomeMsg && currentUser?.username) {
        welcomeMsg.innerHTML = welcomeMsg.innerHTML.replace('¡Hola!', `¡Hola, <strong>${sanitize(currentUser.username)}</strong>!`);
    }
});
