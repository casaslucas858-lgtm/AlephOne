// ============================================================
// AlephOne — comunicacion.js
// Módulo de comunicación: listar, filtrar, crear, expandir.
// ============================================================

const CURSO = '3A';
let filtroActivo = 'todos';
let tipoNuevoMsg = 'anuncio';
let currentUser = null;

// ─── RENDER LISTA ────────────────────────────────────────────
function renderMensajes() {
    const el = document.getElementById('mensajesList');
    let mensajes = AlephAPI.Comunicacion.getParaUsuario(currentUser.username, CURSO);

    if (filtroActivo !== 'todos') {
        mensajes = mensajes.filter(m => m.tipo === filtroActivo);
    }

    if (mensajes.length === 0) {
        el.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>No hay mensajes${filtroActivo !== 'todos' ? ' de este tipo' : ''}</p>
            </div>`;
        return;
    }

    el.innerHTML = mensajes.map(m => {
        const noLeido = !m.leido.includes(currentUser.username);
        const tipoLabel = { urgente: '🔴 Urgente', anuncio: '📢 Anuncio', recordatorio: '⏰ Recordatorio' };
        const tipoClass = { urgente: 'tipo-urgente', anuncio: 'tipo-anuncio', recordatorio: 'tipo-recordatorio' };

        const puedeEliminar = currentUser.role === 'teacher' || currentUser.role === 'director';

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
                <div class="msg-body collapsed" id="body-${m.id}">
                    ${sanitize(m.contenido)}
                </div>
                <div class="msg-footer">
                    <div class="msg-autor">
                        <div class="msg-autor-avatar">${m.autor.charAt(0).toUpperCase()}</div>
                        ${sanitize(m.autor)}
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <span style="font-size:0.75em; color:var(--text-faint);">
                            ${m.leido.length} leído${m.leido.length !== 1 ? 's' : ''}
                        </span>
                        ${puedeEliminar
                            ? `<button class="btn btn-danger btn-sm"
                                onclick="eliminarMensaje(event, '${m.id}')">Eliminar</button>`
                            : ''}
                    </div>
                </div>
            </div>`;
    }).join('');

    // Marcar todos como leídos al cargar (solo los que no estén leídos)
    mensajes.forEach(m => {
        if (!m.leido.includes(currentUser.username)) {
            AlephAPI.Comunicacion.marcarLeido(m.id, currentUser.username);
        }
    });
}

// ─── EXPANDIR / COLAPSAR ────────────────────────────────────
function expandirMensaje(id) {
    const body = document.getElementById(`body-${id}`);
    if (!body) return;
    body.classList.toggle('collapsed');

    // Quitar punto de no leído
    const card = document.getElementById(`msg-${id}`);
    if (card) {
        const dot = card.querySelector('.unread-dot');
        if (dot) dot.remove();
        card.classList.remove('no-leido');
    }
}

// ─── FILTRAR ─────────────────────────────────────────────────
function filtrar(tipo, el) {
    filtroActivo = tipo;
    document.querySelectorAll('.filter-bar .filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderMensajes();
}

// ─── ELIMINAR ────────────────────────────────────────────────
function eliminarMensaje(e, id) {
    e.stopPropagation();
    if (!confirm('¿Eliminar este mensaje?')) return;
    AlephAPI.Comunicacion.eliminar(id);
    showToast('Mensaje eliminado', 'success');
    renderMensajes();
}

// ─── MODAL ───────────────────────────────────────────────────
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
    document.getElementById('msgTipo').value = tipo;
}

// ─── ENVIAR MENSAJE ──────────────────────────────────────────
function enviarMensaje() {
    const titulo   = document.getElementById('msgTitulo').value.trim();
    const contenido = document.getElementById('msgContenido').value.trim();
    const materia  = document.getElementById('msgMateria').value.trim();
    const errorEl  = document.getElementById('msgError');

    if (!titulo) {
        errorEl.textContent = 'El título no puede estar vacío';
        return;
    }
    if (!contenido) {
        errorEl.textContent = 'El contenido no puede estar vacío';
        return;
    }

    AlephAPI.Comunicacion.crear({
        titulo,
        contenido,
        autor: currentUser.username,
        curso: CURSO,
        materia: materia || null,
        tipo: tipoNuevoMsg
    });

    cerrarModal();
    showToast('Mensaje publicado', 'success');
    renderMensajes();
}

// ─── MOBILE NAV ─────────────────────────────────────────────
function toggleMobileNav() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ─── AVATAR ─────────────────────────────────────────────────
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
    currentUser = requireAuth();
    if (!currentUser) return;

    renderAvatar(currentUser);

    // Mostrar botón "Nuevo mensaje" solo a docentes/directores
    if (currentUser.role === 'teacher' || currentUser.role === 'director') {
        const btn = document.getElementById('btnNuevoMensaje');
        if (btn) btn.style.display = 'inline-flex';
    }

    // Cerrar modal con Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') cerrarModal();
    });

    renderMensajes();
});
