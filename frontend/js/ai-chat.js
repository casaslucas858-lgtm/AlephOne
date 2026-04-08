// ============================================================
// AlephOne — ai-chat.js (VERSIÓN FINAL BLINDADA)
// ============================================================

let conversationHistory = [];
let isLoading = false;
let currentUser = null;

// CLAVE QUE PASASTE (Mantenela en privado después de esto)
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

// ─── FUNCIONES DE APOYO ──────────────────────────────────────
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

// ─── MANEJO DE UI ────────────────────────────────────────────
function addBubble(role, text) {
    const container = document.getElementById('chatMessages');
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

// ─── ENVÍO DE MENSAJE ────────────────────────────────────────
async function enviarMensaje() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();

    if (!text || isLoading) return;

    // UI: Bloquear y mostrar
    addBubble('user', text);
    input.value = '';
    isLoading = true;
    showTyping();

    try {
        // Usamos la URL v1 que es la de producción estable
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { 
                    parts: [{ text: SYSTEM_PROMPT }] 
                },
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
            // Si el error es de cuota (429), damos un mensaje claro
            if (data.error.code === 429) {
                addBubble('ai', '⚠️ Che, me están matando a preguntas. Esperá 1 minuto que me tomo un respiro y seguimos.');
            } else {
                addBubble('ai', `⚠️ Error: ${data.error.message}`);
            }
            console.error("Detalle técnico:", data.error);
            return;
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (aiText) {
            // Guardamos en el historial solo si fue exitoso
            conversationHistory.push({ role: 'user', content: text });
            conversationHistory.push({ role: 'assistant', content: aiText });
            addBubble('ai', aiText);
        }

    } catch (err) {
        hideTyping();
        addBubble('ai', '⚠️ Se cortó la conexión. Fijate si tenés internet o si la Key está bien.');
    } finally {
        isLoading = false;
        input.focus();
    }
}

// ─── INICIALIZACIÓN ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Si tenés una función requireAuth en otro lado, esto la llama
    if (typeof requireAuth === 'function') currentUser = requireAuth();

    document.getElementById('chatInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviarMensaje();
        }
    });
});
