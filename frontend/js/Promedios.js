// ============================================================
// AlephOne — promedios.js — FASE 2: async Supabase
// ============================================================

let currentUser = null;
let _notasCache = [];

async function cargarNotas() {
    _notasCache = await AlephAPI.Promedios.getDeAlumno(currentUser.username);
    return _notasCache;
}

function getMaterias(notas) {
    return [...new Set(notas.map(n => n.materia))];
}

function colorPromedio(val) {
    if (val >= 7) return 'alto';
    if (val >= 5) return 'medio';
    return 'bajo';
}

async function renderPromGeneral() {
    const notas = await cargarNotas();
    const el = document.getElementById('promGeneralVal');
    const sub = document.getElementById('promGeneralSub');
    if (notas.length === 0) {
        el.textContent = '—';
        if (sub) sub.textContent = 'Sin notas cargadas';
        return;
    }
    const prom = (notas.reduce((a, n) => a + Number(n.valor), 0) / notas.length).toFixed(2);
    el.textContent = prom;
    const materias = getMaterias(notas);
    if (sub) sub.innerHTML = `${notas.length} nota${notas.length !== 1 ? 's' : ''} · ${materias.length} materia${materias.length !== 1 ? 's' : ''}`;
}

async function renderMaterias() {
    const notas = _notasCache.length ? _notasCache : await cargarNotas();
    const el = document.getElementById('materiasLista');
    const materias = getMaterias(notas);
    const simSelect = document.getElementById('simMateria');

    simSelect.innerHTML = '<option value="">— elegí una —</option>' +
        materias.map(m => `<option value="${sanitize(m)}">${sanitize(m)}</option>`).join('');

    if (materias.length === 0) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Sin notas cargadas todavía</p></div>`;
        return;
    }

    const tipoIcono = { examen: '📝', tarea: '📋', participacion: '🙋' };

    el.innerHTML = materias.map(m => {
        const notasMat = notas.filter(n => n.materia === m).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
        const prom = AlephAPI.Promedios.calcularPromedio(notas, m);
        const colorClass = colorPromedio(prom);
        const pct = Math.min((prom / 10) * 100, 100);
        const barClass = prom >= 7 ? '' : prom >= 5 ? 'warning' : 'danger';

        return `
            <div class="materia-card fade-up">
                <div class="materia-header">
                    <span class="materia-nombre">${sanitize(m)}</span>
                    <span class="promedio-valor ${colorClass}">${prom}</span>
                </div>
                <div class="promedio-bar">
                    <div class="promedio-fill ${barClass}" style="width:${pct}%"></div>
                </div>
                <div class="notas-lista">
                    ${notasMat.map(n => `
                        <div class="nota-row">
                            <span>${tipoIcono[n.tipo] || '📌'} ${sanitize(n.descripcion || n.tipo)}</span>
                            <div style="display:flex;align-items:center;gap:10px;">
                                <span style="font-size:0.75em;color:var(--text-faint);">${formatFecha(n.fecha)}</span>
                                <span class="nota-val ${colorPromedio(Number(n.valor))}">${n.valor}</span>
                            </div>
                        </div>`).join('')}
                </div>
            </div>`;
    }).join('');
}

function simular() {
    const materia = document.getElementById('simMateria').value;
    const objetivo = parseFloat(document.getElementById('simObjetivo').value);
    const resEl = document.getElementById('simResult');

    if (!materia) { resEl.innerHTML = '⚠️ Elegí una materia'; resEl.classList.add('visible'); return; }
    if (isNaN(objetivo) || objetivo < 1 || objetivo > 10) {
        resEl.innerHTML = '⚠️ El objetivo debe estar entre 1 y 10'; resEl.classList.add('visible'); return;
    }

    const notaNecesaria = AlephAPI.Promedios.simular({ notas: _notasCache, materia, promedioObjetivo: objetivo });

    if (notaNecesaria === null)
        resEl.innerHTML = `No hay notas en <strong>${sanitize(materia)}</strong> todavía.`;
    else if (notaNecesaria > 10)
        resEl.innerHTML = `Para llegar a <strong>${objetivo}</strong> en <strong>${sanitize(materia)}</strong> necesitarías <strong>${notaNecesaria}</strong>, lo que supera el máximo. No es posible con una nota más.`;
    else if (notaNecesaria < 1)
        resEl.innerHTML = `✅ Ya superás el promedio de <strong>${objetivo}</strong> en <strong>${sanitize(materia)}</strong>.`;
    else
        resEl.innerHTML = `Para llegar a <strong>${objetivo}</strong> en <strong>${sanitize(materia)}</strong> necesitás al menos <strong>${notaNecesaria}</strong> en la próxima evaluación.`;

    resEl.classList.add('visible');
}

function abrirModalNota() {
    document.getElementById('modalNota').classList.add('open');
    document.getElementById('notaMateria').focus();
}

function cerrarModal() { document.getElementById('modalNota').classList.remove('open'); }
function cerrarModalSiFondo(e) { if (e.target === document.getElementById('modalNota')) cerrarModal(); }

async function guardarNota() {
    const materia = document.getElementById('notaMateria').value.trim();
    const tipo    = document.getElementById('notaTipo').value;
    const valor   = parseFloat(document.getElementById('notaValor').value);
    const desc    = document.getElementById('notaDesc').value.trim();
    const errorEl = document.getElementById('notaError');

    if (!materia) { errorEl.textContent = 'Escribí el nombre de la materia'; return; }
    if (isNaN(valor) || valor < 1 || valor > 10) { errorEl.textContent = 'La nota debe ser entre 1 y 10'; return; }

    const result = await AlephAPI.Promedios.guardarNota({
        username: currentUser.username, materia, tipo, valor, descripcion: desc || null
    });

    if (!result.ok) { errorEl.textContent = 'Error al guardar'; return; }

    cerrarModal();
    showToast('Nota guardada', 'success');
    _notasCache = [];
    await renderPromGeneral();
    await renderMaterias();
}

function toggleMobileNav() { document.getElementById('sidebar').classList.toggle('open'); }

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

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = requireAuth();
    if (!currentUser) return;

    renderAvatar(currentUser);
    document.getElementById('btnCargarNota').style.display = 'inline-flex';
    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

    await renderPromGeneral();
    await renderMaterias();
});
