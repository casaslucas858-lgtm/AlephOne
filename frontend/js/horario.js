// ============================================================
// AlephOne — horario.js — FASE 2: async Supabase
// ============================================================

const CURSO = '3A';
const DIAS = ['lunes','martes','miercoles','jueves','viernes'];
const DIAS_LABEL = { lunes:'Lunes', martes:'Martes', miercoles:'Miércoles', jueves:'Jueves', viernes:'Viernes' };
let currentUser = null;
let bloquesEditando = [];

async function renderTabla() {
    const horario = await AlephAPI.Horario.get(CURSO);
    const head = document.getElementById('scheduleHead');
    const body = document.getElementById('scheduleBody');
    const hoy = diaDeHoy();

    let horas = new Set();
    if (horario?.bloques) DIAS.forEach(d => (horario.bloques[d] || []).forEach(b => horas.add(b.hora)));
    horas = [...horas].sort();

    head.innerHTML = `<tr><th>Hora</th>${DIAS.map(d => `<th class="${d===hoy?'hoy-col':''}">${DIAS_LABEL[d]}${d===hoy?' ★':''}</th>`).join('')}</tr>`;

    if (horas.length === 0) {
        body.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text-faint);">Sin horario cargado</td></tr>`;
        return;
    }

    body.innerHTML = horas.map(hora => `
        <tr>
            <td class="time-col">${sanitize(hora)}</td>
            ${DIAS.map(d => {
                const bloque = (horario?.bloques?.[d] || []).find(b => b.hora === hora);
                if (!bloque) return `<td class="${d===hoy?'hoy-col':''}">—</td>`;
                return `<td class="${d===hoy?'hoy-col':''}">
                    <div class="schedule-cell">
                        ${sanitize(bloque.materia)}
                        <div class="cell-teacher">${sanitize(bloque.docente)}</div>
                    </div></td>`;
            }).join('')}
        </tr>`).join('');
}

async function renderCambios() {
    const cambios = await AlephAPI.Horario.getCambiosHoy(CURSO);
    const section = document.getElementById('cambiosSection');
    const lista = document.getElementById('cambiosList');
    if (cambios.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    lista.innerHTML = cambios.map(c => `
        <div class="cambio-item ${c.tipo}">
            <span style="font-size:1.3em;">${c.tipo === 'cancelacion' ? '❌' : '🔄'}</span>
            <div>
                <strong>${sanitize(c.materia)}</strong> — ${c.tipo === 'cancelacion' ? 'Clase cancelada' : 'Reemplazo docente'}
                ${c.motivo ? `<div style="font-size:0.82em;color:var(--text-muted);">${sanitize(c.motivo)}</div>` : ''}
            </div>
        </div>`).join('');
}

async function registrarCambio() {
    const tipo    = document.getElementById('cambioTipo').value;
    const materia = document.getElementById('cambioMateria').value.trim();
    const motivo  = document.getElementById('cambioMotivo').value.trim();
    const errorEl = document.getElementById('cambioError');
    if (!materia) { errorEl.textContent = 'Indicá la materia afectada'; return; }

    await AlephAPI.Horario.agregarCambio(CURSO, {
        fecha: new Date().toISOString().slice(0, 10), tipo, materia, motivo: motivo || null
    });

    cerrarModal('modalCambio');
    showToast('Cambio registrado', 'success');
    renderCambios();
}

async function renderBloqueEditor() {
    const dia = document.getElementById('editDia').value;
    const horario = await AlephAPI.Horario.get(CURSO);
    bloquesEditando = horario?.bloques?.[dia]
        ? JSON.parse(JSON.stringify(horario.bloques[dia])) : [];
    renderBloques();
}

function renderBloques() {
    const cont = document.getElementById('bloquesEditor');
    if (bloquesEditando.length === 0) {
        cont.innerHTML = `<p style="color:var(--text-faint);font-size:0.88em;margin-bottom:8px;">Sin bloques. Agregá uno.</p>`;
        return;
    }
    cont.innerHTML = bloquesEditando.map((b, i) => `
        <div class="bloque-editor">
            <div class="form-group">
                <label class="form-label">Hora</label>
                <input type="time" class="form-input" value="${b.hora}" onchange="updateBloque(${i},'hora',this.value)">
            </div>
            <div class="form-group" style="flex:2;">
                <label class="form-label">Materia</label>
                <input type="text" class="form-input" value="${sanitize(b.materia)}" placeholder="Materia" onchange="updateBloque(${i},'materia',this.value)">
            </div>
            <div class="form-group" style="flex:2;">
                <label class="form-label">Docente</label>
                <input type="text" class="form-input" value="${sanitize(b.docente)}" placeholder="Docente" onchange="updateBloque(${i},'docente',this.value)">
            </div>
            <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarBloque(${i})" style="margin-bottom:0;flex-shrink:0;">✕</button>
        </div>`).join('');
}

function updateBloque(i, campo, valor) { bloquesEditando[i][campo] = valor; }
function agregarBloque() { bloquesEditando.push({ hora: '08:00', materia: '', docente: '' }); renderBloques(); }
function eliminarBloque(i) { bloquesEditando.splice(i, 1); renderBloques(); }

async function guardarDia() {
    const dia = document.getElementById('editDia').value;
    const horario = await AlephAPI.Horario.get(CURSO);
    const bloques = horario?.bloques || {};
    bloques[dia] = bloquesEditando.filter(b => b.materia.trim() && b.hora).sort((a,b) => a.hora.localeCompare(b.hora));
    await AlephAPI.Horario.guardar(CURSO, bloques);
    cerrarModal('modalEditor');
    showToast('Horario actualizado', 'success');
    renderTabla();
}

async function abrirModal(id) {
    document.getElementById(id).classList.add('open');
    if (id === 'modalEditor') await renderBloqueEditor();
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
    await AlephAPI.Auth.init();
    currentUser = requireAuth();
    if (!currentUser) return;

    renderAvatar(currentUser);
    if (currentUser.role === 'teacher' || currentUser.role === 'director') {
        document.getElementById('btnEditar').style.display = 'inline-flex';
        document.getElementById('btnCambio').style.display = 'inline-flex';
    }
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') ['modalCambio','modalEditor'].forEach(id => cerrarModal(id));
    });

    await renderCambios();
    await renderTabla();
});
