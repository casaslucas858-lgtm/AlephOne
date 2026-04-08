// ============================================================
// AlephOne — comunicacion.js — FASE 2: async Supabase
// ============================================================

const CURSO = '3A';
let filtroActivo = 'todos';
let tipoNuevoMsg = 'anuncio';
let currentUser = null;

async function renderMensajes() {
    const el = document.getElementById('mensajesList');
    el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

    let mensajes = await AlephAPI.Comunicacion.getParaUsuario(currentUser.username, CURSO);
    if (filtroActivo !== 'todos') mensajes = mensajes.filter(m => m.tipo === filtroActivo);

    if (mensajes.length === 0) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No hay mensajes${filtroActivo !== 'todos' ? ' de este tipo' : ''}</p></div>`;
        return;
    }

    const tipoLabel = { urgente: '🔴 Urgente', anuncio: '📢 Anuncio', recordatorio: '⏰ Recordatorio' };
    const tipoClass = { urgente: 'tipo-urgente', anuncio: 'tipo-anuncio', recordatorio: 'tipo-recordatorio' };
    const puedeEliminar = currentUser.role === 'teacher' || currentUser.role === 'director';

    el.innerHTML = mensajes.map(m => {
        const noLeido = !m.leido.includes(currentUser.username);
        return `
            <div class="msg-card ${m.tipo} ${noLeido ? 'no-leido' : ''} fade-up"
                 id="msg-${m.id}" onclick="expandirMensaje('${m.id}')">
                <div class="msg-header">
                    <div class="msg-title-row">
                        ${noLeido ? '<div class="unread-dot"></div>' : ''}
                        <span class="msg-title">${sanitize(m.titulo)}</span>
                        <span class="tag ${tipoClass[m.tipo] || ''}">${tipoLabel[m.tipo] || m.tipo}</span>
                        ${m.materia ? `<span class="tag tag-accent">${sanitize(m.materia)}</span>` : ''}
                    </div>
                    <span class="msg-meta">${formatFechaHora(m.fechaCreacion)}</span>
                </div>
                <div class="msg-body collapsed" id="body-${m.id}">${sanitize(m.contenido)}</div>
                <div class="msg-footer">
                    <div class="msg-autor">
                        <div class="msg-autor-avatar">${m.autor.charAt(0).toUpperCase()}</div>
                        ${sanitize(m.autor)}
                    </div>
                    ${puedeEliminar ? `<button class="btn btn-danger btn-sm" onclick="eliminarMensaje(event,'${m.id}')">Eliminar</button>` : ''}
                </div>
            </div>`;
    }).join('');

    // Marcar todos como leídos
    mensajes.forEach(m => {
        if (!m.leido.includes(currentUser.username))
            AlephAPI.Comunicacion.marcarLeido(m.id, currentUser.username);
    });
}

function expandirMensaje(id) {
    const body = document.getElementById(`body-${id}`);
    if (!body) return;
    body.classList.toggle('collapsed');
    const card = document.getElementById(`msg-${id}`);
    if (card) { card.querySelector('.unread-dot')?.remove(); card.classList.remove('no-leido'); }
}

function filtrar(tipo, el) {
    filtroActivo = tipo;
    document.querySelectorAll('.filter-bar .filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderMensajes();
}

async function eliminarMensaje(e, id) {
    e.stopPropagation();
    if (!confirm('¿Eliminar este mensaje?')) return;
    await AlephAPI.Comunicacion.eliminar(id);
    showToast('Mensaje eliminado', 'success');
    renderMensajes();
}

function abrirModal() {
    document.getElementById('modalOverlay').classList.add('open');
    document.getElementById('msgTitulo').focus();
}

function cerrarModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    limpiarModal();
}

function cerrarModalSiEsFondo(e) {
    if (e.target === document.getElementById('modalOverlay')) cerrarModal();
}

function limpiarModal() {
    document.getElementById('msgTitulo').value = '';
    document.getElementById('msgContenido').value = '';
    document.getElementById('msgMateria').value = '';
    document.getElementById('msgError').textContent = '';
    seleccionarTipo('anuncio', document.querySelector('[data-tipo="anuncio"]'));
}

function seleccionarTipo(tipo, el) {
    tipoNuevoMsg = tipo;
    document.querySelectorAll('.modal .filter-chip').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
}

async function enviarMensaje() {
    const titulo    = document.getElementById('msgTitulo').value.trim();
    const contenido = document.getElementById('msgContenido').value.trim();
    const materia   = document.getElementById('msgMateria').value.trim();
    const errorEl   = document.getElementById('msgError');

    if (!titulo)    { errorEl.textContent = 'El título no puede estar vacío'; return; }
    if (!contenido) { errorEl.textContent = 'El contenido no puede estar vacío'; return; }

    const result = await AlephAPI.Comunicacion.crear({
        titulo, contenido,
        autor: currentUser.username,
        curso: CURSO,
        materia: materia || null,
        tipo: tipoNuevoMsg
    });

    if (!result.ok) { errorEl.textContent = result.error; return; }

    cerrarModal();
    showToast('Mensaje publicado', 'success');
    renderMensajes();
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

    if (currentUser.role === 'teacher' || currentUser.role === 'director') {
        document.getElementById('btnNuevoMensaje').style.display = 'inline-flex';
    }

    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

    await renderMensajes();
});
