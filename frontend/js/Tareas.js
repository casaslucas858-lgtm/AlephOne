// ============================================================
// AlephOne — tareas.js — FASE 2: async Supabase
// ============================================================

const CURSO = '3A';
let filtroActivo = 'todas';
let tareaEntregaId = null;
let currentUser = null;

async function renderTareas() {
    const el = document.getElementById('tareasList');
    el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
    const now = new Date();

    let tareas = currentUser.role === 'teacher'
        ? await AlephAPI.Tareas.getDelDocente(currentUser.username)
        : await AlephAPI.Tareas.getParaCurso(CURSO);

    if (filtroActivo !== 'todas') tareas = tareas.filter(t => t.tipo === filtroActivo);

    if (tareas.length === 0) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No hay tareas${filtroActivo !== 'todas' ? ' de este tipo' : ''}</p></div>`;
        return;
    }

    el.innerHTML = tareas.map(t => {
        const dias = Math.ceil((new Date(t.fechaCierre) - now) / 86400000);
        const entregada = t.entregas?.find(e => e.alumno_username === currentUser.username);
        const vencida = dias < 0;

        let urgClass, diasLabel, diasBadge;
        if (entregada)      { urgClass = 'entregada'; diasLabel = '✓ Entregada'; diasBadge = 'success'; }
        else if (vencida)   { urgClass = 'urgente';   diasLabel = 'Vencida';     diasBadge = 'hoy'; }
        else if (dias <= 1) { urgClass = 'urgente';   diasLabel = dias === 0 ? 'Hoy' : 'Mañana'; diasBadge = 'hoy'; }
        else if (dias <= 3) { urgClass = 'pronto';    diasLabel = `${dias}d`;    diasBadge = 'pronto'; }
        else                { urgClass = 'normal';    diasLabel = `${dias}d`;    diasBadge = 'normal'; }

        const tipoIcono = { tarea: '📋', quiz: '🧪', examen: '📝' };
        const isTeacher = currentUser.role === 'teacher' || currentUser.role === 'director';

        return `
            <div class="tarea-card ${urgClass} fade-up">
                <div class="tarea-header">
                    <span class="tarea-titulo">${tipoIcono[t.tipo] || '📋'} ${sanitize(t.titulo)}</span>
                    <span class="dias-badge ${diasBadge}">${diasLabel}</span>
                </div>
                <p class="tarea-desc">${sanitize(t.descripcion || '')}</p>
                <div class="tarea-footer">
                    <div class="tarea-meta-row">
                        ${t.materia ? `<span class="tag tag-accent">${sanitize(t.materia)}</span>` : ''}
                        <span class="tag tag-primary">${sanitize(t.tipo)}</span>
                        <span style="font-size:0.78em;color:var(--text-faint);">Cierre: ${formatFecha(t.fechaCierre)}</span>
                    </div>
                    <div style="display:flex;gap:8px;">
                        ${isTeacher
                            ? `<button class="btn btn-secondary btn-sm" onclick="verEntregas('${t.id}')">Ver entregas (${t.entregas?.length || 0})</button>
                               <button class="btn btn-danger btn-sm" onclick="eliminarTarea('${t.id}')">Eliminar</button>`
                            : entregada
                                ? `<div class="entrega-done">✅ Entregada el ${formatFecha(entregada.created_at)}</div>`
                                : vencida
                                    ? `<span class="tag tag-danger">Sin entregar</span>`
                                    : `<button class="btn btn-primary btn-sm" onclick="abrirEntrega('${t.id}','${sanitize(t.titulo)}')">Entregar →</button>`
                        }
                    </div>
                </div>
            </div>`;
    }).join('');
}

function filtrar(tipo, el) {
    filtroActivo = tipo;
    document.querySelectorAll('.filter-bar .filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderTareas();
}

function abrirModalTarea() {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(23, 59, 0, 0);
    const localISO = new Date(manana.getTime() - manana.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('tareaCierre').value = localISO;
    document.getElementById('modalTarea').classList.add('open');
    document.getElementById('tareaTitulo').focus();
}

function selTipo(tipo, el) {
    document.getElementById('tареaTipo').value = tipo;
    document.querySelectorAll('#modalTarea .filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
}

async function crearTarea() {
    const titulo  = document.getElementById('tareaTitulo').value.trim();
    const desc    = document.getElementById('tareaDesc').value.trim();
    const materia = document.getElementById('tareaMateria').value.trim();
    const cierre  = document.getElementById('tareaCierre').value;
    const tipo    = document.getElementById('tареaTipo').value;
    const errorEl = document.getElementById('tareaError');

    if (!titulo) { errorEl.textContent = 'El título no puede estar vacío'; return; }
    if (!cierre) { errorEl.textContent = 'Elegí una fecha de cierre'; return; }

    const result = await AlephAPI.Tareas.crear({
        titulo, descripcion: desc, materia: materia || null,
        curso: CURSO, autor: currentUser.username,
        fechaCierre: new Date(cierre).toISOString(), tipo
    });

    if (!result.ok) { errorEl.textContent = result.error; return; }

    cerrarModal('modalTarea');
    document.getElementById('tareaTitulo').value = '';
    document.getElementById('tareaDesc').value = '';
    document.getElementById('tareaMateria').value = '';
    showToast('Tarea publicada', 'success');
    renderTareas();
}

function abrirEntrega(tareaId, titulo) {
    tareaEntregaId = tareaId;
    document.getElementById('entregaTareaTitle').textContent = titulo;
    document.getElementById('entregaContenido').value = '';
    document.getElementById('entregaError').textContent = '';
    document.getElementById('modalEntrega').classList.add('open');
    document.getElementById('entregaContenido').focus();
}

async function confirmarEntrega() {
    const contenido = document.getElementById('entregaContenido').value.trim();
    const errorEl = document.getElementById('entregaError');
    if (!contenido) { errorEl.textContent = 'Escribí algo antes de entregar'; return; }

    const result = await AlephAPI.Tareas.entregar({
        tareaId: tareaEntregaId,
        username: currentUser.username,
        contenido
    });

    if (!result.ok) { errorEl.textContent = result.error; return; }

    cerrarModal('modalEntrega');
    showToast('¡Tarea entregada! ✅', 'success');
    renderTareas();
}

async function verEntregas(tareaId) {
    const tareas = await AlephAPI.Tareas.getDelDocente(currentUser.username);
    const tarea = tareas.find(t => t.id === tareaId);
    if (!tarea) return;

    document.getElementById('entregasModalTitle').textContent =
        `📤 Entregas: ${tarea.titulo} (${tarea.entregas?.length || 0})`;

    const lista = document.getElementById('entregasLista');
    if (!tarea.entregas?.length) {
        lista.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>Sin entregas todavía</p></div>`;
    } else {
        lista.innerHTML = `
            <table class="entregas-tabla">
                <thead><tr><th>Alumno</th><th>Entregado</th><th>Nota</th><th>Respuesta</th></tr></thead>
                <tbody>
                    ${tarea.entregas.map(e => `
                        <tr>
                            <td><strong>${sanitize(e.alumno_username)}</strong></td>
                            <td>${formatFechaHora(e.created_at)}</td>
                            <td><input type="number" min="1" max="10" step="0.5"
                                value="${e.nota !== null ? e.nota : ''}" placeholder="—"
                                style="width:60px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-subtle);color:var(--text);"
                                onchange="calificar('${tareaId}','${e.alumno_username}',this.value)"></td>
                            <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
                                title="${sanitize(e.contenido)}">${sanitize(e.contenido)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    }
    document.getElementById('modalEntregas').classList.add('open');
}

async function calificar(tareaId, username, valor) {
    const nota = parseFloat(valor);
    if (isNaN(nota) || nota < 1 || nota > 10) return;
    await AlephAPI.Tareas.calificar({ tareaId, username, nota });
    showToast(`Nota ${nota} guardada`, 'success');
}

async function eliminarTarea(tareaId) {
    if (!confirm('¿Eliminar esta tarea?')) return;
    await AlephAPI.Tareas.eliminar(tareaId);
    showToast('Tarea eliminada', 'success');
    renderTareas();
}

function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }
function cerrarModalSiFondo(e, id) { if (e.target === document.getElementById(id)) cerrarModal(id); }
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
    if (currentUser.role === 'teacher' || currentUser.role === 'director')
        document.getElementById('btnNuevaTarea').style.display = 'inline-flex';

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') ['modalTarea','modalEntrega','modalEntregas'].forEach(id => cerrarModal(id));
    });

    await renderTareas();
});
