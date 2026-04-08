// ============================================================
// AlephOne — dashboard.js — FASE 2: async Supabase
// ============================================================

const CURSO = '3A';
const DIAS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

async function renderGreeting(user) {
    const now = new Date();
    const hora = now.getHours();
    const dia = DIAS_ES[now.getDay()];
    const fecha = `${now.getDate()} de ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][now.getMonth()]} de ${now.getFullYear()}`;

    let saludo;
    if (hora < 12) saludo = 'Buenos días';
    else if (hora < 19) saludo = 'Buenas tardes';
    else saludo = 'Buenas noches';

    document.getElementById('greetingDia').textContent = dia.toUpperCase();
    document.getElementById('greetingMsg').textContent = `${saludo}, ${user.username} 👋`;
    document.getElementById('greetingDate').textContent = fecha;

    const tareas = await AlephAPI.Tareas.getParaCurso(CURSO);
    const pendientes = tareas.filter(t => !t.entregas?.find(e => e.alumno_username === user.username));
    const urgentes = pendientes.filter(t => Math.ceil((new Date(t.fechaCierre) - now) / 86400000) <= 1);
    const mensajes = await AlephAPI.Comunicacion.getParaUsuario(user.username, CURSO);
    const noLeidos = mensajes.filter(m => !m.leido.includes(user.username));

    const badgesEl = document.getElementById('greetingBadges');
    badgesEl.innerHTML = '';
    if (urgentes.length > 0)
        badgesEl.innerHTML += `<span class="greeting-badge urgent">⚠️ ${urgentes.length} tarea${urgentes.length > 1 ? 's urgentes' : ' urgente'}</span>`;
    if (noLeidos.length > 0)
        badgesEl.innerHTML += `<span class="greeting-badge">📢 ${noLeidos.length} mensaje${noLeidos.length > 1 ? 's' : ''} sin leer</span>`;
    if (pendientes.length === 0)
        badgesEl.innerHTML += `<span class="greeting-badge">✅ Todo al día</span>`;
}

async function renderStats(user) {
    const tareas = await AlephAPI.Tareas.getParaCurso(CURSO);
    const pendientes = tareas.filter(t => !t.entregas?.find(e => e.alumno_username === user.username));
    const mensajes = await AlephAPI.Comunicacion.getParaUsuario(user.username, CURSO);
    const noLeidos = mensajes.filter(m => !m.leido.includes(user.username));
    const notas = await AlephAPI.Promedios.getDeAlumno(user.username);
    const eventos = await AlephAPI.Calendario.getProximos(CURSO, 7);

    let promGeneral = '—';
    if (notas.length > 0) {
        promGeneral = (notas.reduce((a, n) => a + Number(n.valor), 0) / notas.length).toFixed(1);
    }

    const statsData = user.role === 'student'
        ? [
            { label: 'Tareas pendientes', value: pendientes.length, sub: 'sin entregar' },
            { label: 'Mensajes sin leer',  value: noLeidos.length,  sub: 'nuevos' },
            { label: 'Promedio general',   value: promGeneral,       sub: 'sobre 10' },
            { label: 'Próximos eventos',   value: eventos.length,    sub: 'esta semana' }
          ]
        : [
            { label: 'Tareas creadas',    value: (await AlephAPI.Tareas.getDelDocente(user.username)).length, sub: 'en total' },
            { label: 'Mensajes enviados', value: mensajes.filter(m => m.autor === user.username).length, sub: 'comunicados' },
            { label: 'Próximos eventos',  value: eventos.length, sub: 'esta semana' },
            { label: 'Alumnos activos',   value: '—', sub: 'próximamente' }
          ];

    document.getElementById('statsGrid').innerHTML = statsData.map(s => `
        <div class="stat-card fade-up">
            <div class="stat-label">${sanitize(s.label)}</div>
            <div class="stat-value">${sanitize(String(s.value))}</div>
            <div class="stat-sub">${sanitize(s.sub)}</div>
        </div>`).join('');
}

async function renderTareas(user) {
    const el = document.getElementById('tareasList');
    const tareas = await AlephAPI.Tareas.getParaCurso(CURSO);
    const now = new Date();

    const lista = user.role === 'student'
        ? tareas.filter(t => !t.entregas?.find(e => e.alumno_username === user.username))
        : await AlephAPI.Tareas.getDelDocente(user.username);

    if (lista.length === 0) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>${user.role === 'student' ? 'No tenés tareas pendientes' : 'No creaste tareas aún'}</p></div>`;
        return;
    }

    el.innerHTML = lista.slice(0, 5).map(t => {
        const dias = Math.ceil((new Date(t.fechaCierre) - now) / 86400000);
        let urgencia, badgeClass, badgeText;
        if (dias <= 0)      { urgencia = 'vence-hoy';    badgeClass = 'hoy';    badgeText = 'Hoy'; }
        else if (dias <= 2) { urgencia = 'vence-pronto'; badgeClass = 'pronto'; badgeText = `${dias}d`; }
        else                { urgencia = 'vence-normal'; badgeClass = 'normal'; badgeText = `${dias}d`; }

        const entregas = user.role === 'teacher'
            ? `<span style="color:var(--text-faint);font-size:0.75em;">${t.entregas?.length || 0} entregas</span>` : '';

        return `
            <div class="tarea-item ${urgencia}" onclick="window.location.href='tareas.html'">
                <div class="tarea-check"></div>
                <div class="tarea-info">
                    <div class="tarea-title">${sanitize(t.titulo)}</div>
                    <div class="tarea-meta">${sanitize(t.materia || '')} · Cierre: ${formatFecha(t.fechaCierre)} ${entregas}</div>
                </div>
                <span class="dias-badge ${badgeClass}">${badgeText}</span>
            </div>`;
    }).join('');
}

async function renderMensajes(user) {
    const el = document.getElementById('mensajesList');
    const mensajes = await AlephAPI.Comunicacion.getParaUsuario(user.username, CURSO);

    if (mensajes.length === 0) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>Sin mensajes</p></div>`;
        return;
    }

    el.innerHTML = mensajes.slice(0, 4).map(m => {
        const noLeido = !m.leido.includes(user.username);
        return `
            <div class="mensaje-item ${m.tipo}" onclick="marcarLeidoYRedirigir('${m.id}', '${user.username}')">
                <div class="mensaje-header">
                    <span class="mensaje-titulo">${noLeido ? '🔵 ' : ''}${sanitize(m.titulo)}</span>
                    <span class="mensaje-fecha">${formatFechaHora(m.fechaCreacion)}</span>
                </div>
                <div class="mensaje-preview">${sanitize(m.contenido)}</div>
            </div>`;
    }).join('');
}

async function marcarLeidoYRedirigir(mensajeId, username) {
    await AlephAPI.Comunicacion.marcarLeido(mensajeId, username);
    window.location.href = 'comunicacion.html';
}

async function renderClasesHoy() {
    const el = document.getElementById('clasesHoy');
    const horario = await AlephAPI.Horario.get(CURSO);
    const diaKey = diaDeHoy();

    if (!horario?.bloques?.[diaKey]?.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><p>No hay clases hoy</p></div>`;
        return;
    }

    const ahora = new Date();
    const horaActual = ahora.getHours() * 60 + ahora.getMinutes();

    el.innerHTML = horario.bloques[diaKey].map(bloque => {
        const [h, m] = bloque.hora.split(':').map(Number);
        const isCurrent = horaActual >= h * 60 + m && horaActual < h * 60 + m + 60;
        return `
            <div class="schedule-item ${isCurrent ? 'current' : ''}">
                <span class="schedule-time">${sanitize(bloque.hora)}</span>
                <div class="schedule-dot"></div>
                <div class="schedule-info">
                    <div class="schedule-subject">${sanitize(bloque.materia)}</div>
                    <div class="schedule-teacher">${sanitize(bloque.docente)}</div>
                </div>
                ${isCurrent ? '<span class="tag tag-primary">Ahora</span>' : ''}
            </div>`;
    }).join('');
}

async function renderEventos() {
    const el = document.getElementById('eventosList');
    const eventos = await AlephAPI.Calendario.getProximos(CURSO, 14);

    if (eventos.length === 0) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>Sin eventos próximos</p></div>`;
        return;
    }

    const tipoIconos = { examen: '📝', entrega: '📤', evento: '🎉', feriado: '🏖️' };
    el.innerHTML = eventos.slice(0, 5).map(e => {
        const fecha = new Date(e.fecha);
        return `
            <div class="evento-item">
                <div class="evento-fecha-box">
                    <span class="evento-dia">${fecha.getDate()}</span>
                    <span class="evento-mes">${MESES_ES[fecha.getMonth()]}</span>
                </div>
                <div class="evento-info">
                    <div class="evento-titulo">${tipoIconos[e.tipo] || '📌'} ${sanitize(e.titulo)}</div>
                    <div class="evento-tipo-tag">${sanitize(e.descripcion || e.tipo)}</div>
                </div>
            </div>`;
    }).join('');
}

async function updateNavBadges(user) {
    const mensajes = await AlephAPI.Comunicacion.getParaUsuario(user.username, CURSO);
    const noLeidos = mensajes.filter(m => !m.leido.includes(user.username)).length;
    const badgeMsg = document.getElementById('navBadgeMensajes');
    if (badgeMsg) { badgeMsg.textContent = noLeidos; badgeMsg.style.display = noLeidos > 0 ? '' : 'none'; }

    const tareas = await AlephAPI.Tareas.getParaCurso(CURSO);
    const pendientes = tareas.filter(t => !t.entregas?.find(e => e.alumno_username === user.username)).length;
    const badgeTar = document.getElementById('navBadgeTareas');
    if (badgeTar) { badgeTar.textContent = pendientes; badgeTar.style.display = pendientes > 0 ? '' : 'none'; }
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

function toggleMobileNav() {
    document.getElementById('sidebar').classList.toggle('open');
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = requireAuth();
    if (!user) return;

    if (user.role === 'teacher' || user.role === 'director') {
        const panel = document.getElementById('teacherPanel');
        if (panel) panel.style.display = 'block';
    }

    renderAvatar(user);

    await Promise.all([
        renderGreeting(user),
        renderStats(user),
        renderTareas(user),
        renderMensajes(user),
        renderClasesHoy(),
        renderEventos(),
        updateNavBadges(user)
    ]);
});
