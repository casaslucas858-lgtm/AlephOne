// ============================================================
// AlephOne — promedios.js
// ============================================================

let currentUser = null;

function getMaterias(username) {
    const notas = AlephAPI.Promedios.getDeAlumno(username);
    return [...new Set(notas.map(n => n.materia))];
}

function colorPromedio(val) {
    if (val >= 7) return 'alto';
    if (val >= 5) return 'medio';
    return 'bajo';
}

// ─── RENDER GENERAL ─────────────────────────────────────────
function renderPromGeneral() {
    const notas = AlephAPI.Promedios.getDeAlumno(currentUser.username);
    const el = document.getElementById('promGeneralVal');
    const sub = document.getElementById('promGeneralSub');

    if (notas.length === 0) {
        el.textContent = '—';
        if (sub) sub.textContent = 'Sin notas cargadas';
        return;
    }
    const suma = notas.reduce((a, n) => a + n.valor, 0);
    const prom = (suma / notas.length).toFixed(2);
    el.textContent = prom;
    if (sub) sub.innerHTML = `${notas.length} nota${notas.length !== 1 ? 's' : ''} registrada${notas.length !== 1 ? 's' : ''}<br>${getMaterias(currentUser.username).length} materia${getMaterias(currentUser.username).length !== 1 ? 's' : ''}`;
}

// ─── RENDER POR MATERIA ──────────────────────────────────────
function renderMaterias() {
    const el = document.getElementById('materiasLista');
    const materias = getMaterias(currentUser.username);
    const simSelect = document.getElementById('simMateria');

    // Actualizar selector del simulador
    simSelect.innerHTML = '<option value="">— elegí una —</option>' +
        materias.map(m => `<option value="${sanitize(m)}">${sanitize(m)}</option>`).join('');

    if (materias.length === 0) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Sin notas cargadas todavía</p></div>`;
        return;
    }

    const tipoIcono = { examen: '📝', tarea: '📋', participacion: '🙋', asistencia: '✅' };

    el.innerHTML = materias.map(m => {
        const notas = AlephAPI.Promedios.getDeAlumno(currentUser.username)
            .filter(n => n.materia === m)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        const prom = AlephAPI.Promedios.calcularPromedio(currentUser.username, m);
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
                    ${notas.map(n => `
                        <div class="nota-row">
                            <span>${tipoIcono[n.tipo] || '📌'} ${sanitize(n.descripcion || n.tipo)}</span>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <span style="font-size:0.75em; color:var(--text-faint);">${formatFecha(n.fecha)}</span>
                                <span class="nota-val ${colorPromedio(n.valor)}">${n.valor}</span>
                            </div>
                        </div>`).join('')}
                </div>
            </div>`;
    }).join('');
}

// ─── SIMULADOR ───────────────────────────────────────────────
function simular() {
    const materia = document.getElementById('simMateria').value;
    const objetivo = parseFloat(document.getElementById('simObjetivo').value);
    const resEl = document.getElementById('simResult');

    if (!materia) { resEl.innerHTML = '⚠️ Elegí una materia'; resEl.classList.add('visible'); return; }
    if (isNaN(objetivo) || objetivo < 1 || objetivo > 10) {
        resEl.innerHTML = '⚠️ El objetivo debe estar entre 1 y 10';
        resEl.classList.add('visible'); return;
    }

    const notaNecesaria = AlephAPI.Promedios.simular({
        username: currentUser.username, materia, promedioObjetivo: objetivo
    });

    if (notaNecesaria === null) {
        resEl.innerHTML = `No hay notas en <strong>${sanitize(materia)}</strong> todavía.`;
    } else if (notaNecesaria > 10) {
        resEl.innerHTML = `Para llegar a <strong>${objetivo}</strong> en <strong>${sanitize(materia)}</strong> necesitarías <strong>${notaNecesaria}</strong>, lo que supera el máximo (10). No es posible con una sola nota más.`;
    } else if (notaNecesaria < 1) {
        resEl.innerHTML = `✅ Ya tenés promedio mayor a <strong>${objetivo}</strong> en <strong>${sanitize(materia)}</strong>. ¡Vas bien!`;
    } else {
        resEl.innerHTML = `Para llegar a <strong>${objetivo}</strong> en <strong>${sanitize(materia)}</strong> necesitás sacar al menos <strong>${notaNecesaria}</strong> en la próxima evaluación.`;
    }
    resEl.classList.add('visible');
}

// ─── MODAL NOTA ─────────────────────────────────────────────
function abrirModalNota() {
    document.getElementById('modalNota').classList.add('open');
    document.getElementById('notaMateria').focus();
}

function cerrarModal() {
    document.getElementById('modalNota').classList.remove('open');
    document.getElementById('notaError').textContent = '';
}

function cerrarModalSiFondo(e) {
    if (e.target === document.getElementById('modalNota')) cerrarModal();
}

function guardarNota() {
    const materia = document.getElementById('notaMateria').value.trim();
    const tipo    = document.getElementById('notaTipo').value;
    const valor   = parseFloat(document.getElementById('notaValor').value);
    const desc    = document.getElementById('notaDesc').value.trim();
    const errorEl = document.getElementById('notaError');

    if (!materia) { errorEl.textContent = 'Escribí el nombre de la materia'; return; }
    if (isNaN(valor) || valor < 1 || valor > 10) { errorEl.textContent = 'La nota debe ser entre 1 y 10'; return; }

    AlephAPI.Promedios.guardarNota({
        username: currentUser.username, materia, tipo, valor,
        descripcion: desc || null
    });

    cerrarModal();
    showToast('Nota guardada', 'success');
    renderPromGeneral();
    renderMaterias();
}

function toggleMobileNav() {
    document.getElementById('sidebar').classList.toggle('open');
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

document.addEventListener('DOMContentLoaded', () => {
    currentUser = requireAuth();
    if (!currentUser) return;

    renderAvatar(currentUser);
    document.getElementById('btnCargarNota').style.display = 'inline-flex';

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') cerrarModal();
    });

    renderPromGeneral();
    renderMaterias();
});
