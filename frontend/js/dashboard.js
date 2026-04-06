// ============================================================
// AlephOne — dashboard.js
// Lógica del dashboard principal: saludo, stats, tareas,
// mensajes, horario de hoy, próximos eventos.
// ============================================================

// ─── CONSTANTES ─────────────────────────────────────────────
const CURSO_DEMO = '3A'; // En backend esto vendrá del perfil del usuario

const DIAS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

// ─── SALUDO DINÁMICO ────────────────────────────────────────
function renderGreeting(user) {
    const now = new Date();
    const hora = now.getHours();
    const dia = DIAS_ES[now.getDay()];
    const fecha = `${now.getDate()} de ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][now.getMonth()]} de ${now.getFullYear()}`;

    let saludo;
    if (hora < 12) saludo = 'Buenos días';
    else if (hora < 19) saludo = 'Buenas tardes';
    else saludo = 'Buenas noches';

    const roles = { student: 'Estudiante', teacher: 'Profe', director: 'Director/a' };

    document.getElementById('greetingDia').textContent = dia.toUpperCase();
    document.getElementById('greetingMsg').textContent = `${saludo}, ${user.username} 👋`;
    document.getElementById('greetingDate').textContent = fecha;

    // Badges de resumen
    const tareas = AlephAPI.Tareas.getParaCurso(CURSO_DEMO);
    const pendientes = tareas.filter(t => {
        const entregada = t.entregas?.find(e => e.username === user.username);
        return !entregada;
    });
    const urgentes = pendientes.filter(t => {
        const dias = Math.ceil((new Date(t.fechaCierre) - now) / 86400000);
        return dias <= 1;
    });

    const mensajes = AlephAPI.Comunicacion.getParaUsuario(user.username, CURSO_DEMO);
    const noLeidos = mensajes.filter(m => !m.leido.includes(user.username));

    const badgesEl = document.getElementById('greetingBadges');
    badgesEl.innerHTML = '';

    if (urgentes.length > 0) {
        badgesEl.innerHTML += `<span class="greeting-badge urgent">⚠️ ${urgentes.length} tarea${urgentes.length > 1 ? 's' : ''} urgente${urgentes.length > 1 ? 's' : ''}</span>`;
    }
    if (noLeidos.length > 0) {
        badgesEl.innerHTML += `<span class="greeting-badge">📢 ${noLeidos.length} mensaje${noLeidos.length > 1 ? 's' : ''} sin leer</span>`;
    }
    if (pendientes.length === 0) {
        badgesEl.innerHTML += `<span class="greeting-badge">✅ Todo al día</span>`;
    }
}

// ─── STATS ──────────────────────────────────────────────────
function renderStats(user) {
    const tareas = AlephAPI.Tareas.getParaCurso(CURSO_DEMO);
    const pendientes = tareas.filter(t => !t.entregas?.find(e => e.username === user.username));
    const mensajes = AlephAPI.Comunicacion.getParaUsuario(user.username, CURSO_DEMO);
    const noLeidos = mensajes.filter(m => !m.leido.includes(user.username));
    const notas = AlephAPI.Promedios.getDeAlumno(user.username);

    let promGeneral = '—';
    if (notas.length > 0) {
        const suma = notas.reduce((a, n) => a + n.valor, 0);
        promGeneral = (suma / notas.length).toFixed(1);
    }

    const statsData = user.role === 'student'
        ? [
            { label: 'Tareas pendientes', value: pendientes.length, sub: 'sin entregar' },
            { label: 'Mensajes sin leer',  value: noLeidos.length,  sub: 'nuevos' },
            { label: 'Promedio general',   value: promGeneral,       sub: 'sobre 10' },
            { label: 'Próximos eventos',   value: AlephAPI.Calendario.getProximos(CURSO_DEMO, 7).length, sub: 'esta semana' }
          ]
        : [
            { label: 'Tareas creadas',  value: AlephAPI.Tareas.getDelDocente(user.username).length, sub: 'en total' },
            { label: 'Mensajes enviados', value: mensajes.filter(m => m.autor === user.username).length, sub: 'comunicados' },
            { label: 'Próximos eventos', value: AlephAPI.Calendario.getProximos(CURSO_DEMO, 7).length, sub: 'esta semana' },
            { label: 'Alumnos activos',  value: '—', sub: 'próximamente' }
          ];

    document.getElementById('statsGrid').innerHTML = statsData.map(s => `
        <div class="stat-card fade-up">
            <div class="stat-label">${sanitize(s.label)}</div>
            <div class="stat-value">${sanitize(String(s.value))}</div>
            <div class="stat-sub">${sanitize(s.sub)}</div>
        </div>
    `).join('');
}

// ─── TAREAS PENDIENTES ───────────────────────────────────────
function renderTareas(user) {
    const el = document.getElementById('tareasList');
    const tareas = AlephAPI.Tareas.getParaCurso(CURSO_DEMO);
    const now = new Date();

    const pendientes = tareas.filter(t => {
        if (user.role !== 'student') return false;
        return !t.entregas?.find(e => e.username === user.username);
    });

    // Para docente: mostrar tareas propias con estado de entregas
    const lista = user.role === 'student'
        ? pendientes
        : AlephAPI.Tareas.getDelDocente(user.username);

    if (lista.length === 0) {
        el.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✅</div>
                <p>${user.role === 'student' ? 'No tenés tareas pendientes' : 'No creaste tareas aún'}</p>
            </div>`;
        return;
    }

    el.innerHTML = lista.slice(0, 5).map(t => {
        const dias = Math.ceil((new Date(t.fechaCierre) - now) / 86400000);
        let urgencia, badgeClass, badgeText;

        if (dias <= 0) {
            urgencia = 'vence-hoy'; badgeClass = 'hoy'; badgeText = 'Hoy';
        } else if (dias <= 2) {
            urgencia = 'vence-pronto'; badgeClass = 'pronto'; badgeText = `${dias}d`;
        } else {
            urgencia = 'vence-normal'; badgeClass = 'normal'; badgeText = `${dias}d`;
        }

        const entregas = user.role === 'teacher'
            ? `<span style="color:var(--text-faint);font-size:0.75em;">${t.entregas?.length || 0} entrega${t.entregas?.length !== 1 ? 's' : ''}</span>`
            : '';

        return `
            <div class="tarea-item ${urgencia}" onclick="window.location.href='tareas.html'">
                <div class="tarea-check"></div>
                <div class="tarea-info">
                    <div class="tarea-title">${sanitize(t.titulo)}</div>
                    <div class="tarea-meta">${sanitize(t.materia)} · Cierre: ${formatFecha(t.fechaCierre)} ${entregas}</div>
                </div>
                <span class="dias-badge ${badgeClass}">${badgeText}</span>
            </div>`;
    }).join('');
}

// ─── MENSAJES RECIENTES ──────────────────────────────────────
function renderMensajes(user) {
    const el = document.getElementById('mensajesList');
    const mensajes = AlephAPI.Comunicacion.getParaUsuario(user.username, CURSO_DEMO);

    if (mensajes.length === 0) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>Sin mensajes</p></div>`;
        return;
    }

    el.innerHTML = mensajes.slice(0, 4).map(m => {
        const noLeido = !m.leido.includes(user.username);
        return `
            <div class="mensaje-item ${m.tipo}" onclick="marcarLeidoYRedirigir('${m.id}', '${user.username}')">
                <div class="mensaje-header">
                    <span class="mensaje-titulo">
                        ${noLeido ? '🔵 ' : ''}${sanitize(m.titulo)}
                    </span>
                    <span class="mensaje-fecha">${formatFechaHora(m.fechaCreacion)}</span>
                </div>
                <div class="mensaje-preview">${sanitize(m.contenido)}</div>
            </div>`;
    }).join('');
}

function marcarLeidoYRedirigir(mensajeId, username) {
    AlephAPI.Comunicacion.marcarLeido(mensajeId, username);
    window.location.href = 'comunicacion.html';
}

// ─── CLASES DE HOY ───────────────────────────────────────────
function renderClasesHoy() {
    const el = document.getElementById('clasesHoy');
    const horario = AlephAPI.Horario.get(CURSO_DEMO);
    const diaKey = diaDeHoy(); // de app.js

    if (!horario || !horario.bloques[diaKey] || horario.bloques[diaKey].length === 0) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><p>No hay clases hoy</p></div>`;
        return;
    }

    const ahora = new Date();
    const horaActual = ahora.getHours() * 60 + ahora.getMinutes();

    el.innerHTML = horario.bloques[diaKey].map(bloque => {
        const [h, m] = bloque.hora.split(':').map(Number);
        const minBloque = h * 60 + m;
        const isCurrent = horaActual >= minBloque && horaActual < minBloque + 60;

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

// ─── PRÓXIMOS EVENTOS ────────────────────────────────────────
function renderEventos() {
    const el = document.getElementById('eventosList');
    const eventos = AlephAPI.Calendario.getProximos(CURSO_DEMO, 14);

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

// ─── NAV BADGES ─────────────────────────────────────────────
function updateNavBadges(user) {
    const mensajes = AlephAPI.Comunicacion.getParaUsuario(user.username, CURSO_DEMO);
    const noLeidos = mensajes.filter(m => !m.leido.includes(user.username)).length;
    const badgeMsg = document.getElementById('navBadgeMensajes');
    if (badgeMsg) {
        badgeMsg.textContent = noLeidos;
        badgeMsg.style.display = noLeidos > 0 ? '' : 'none';
    }

    const tareas = AlephAPI.Tareas.getParaCurso(CURSO_DEMO);
    const pendientes = tareas.filter(t => !t.entregas?.find(e => e.username === user.username)).length;
    const badgeTar = document.getElementById('navBadgeTareas');
    if (badgeTar) {
        badgeTar.textContent = pendientes;
        badgeTar.style.display = pendientes > 0 ? '' : 'none';
    }
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

// ─── MOBILE NAV ─────────────────────────────────────────────
function toggleMobileNav() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const user = requireAuth();
    if (!user) return;

    // Mostrar panel docente si corresponde
    if (user.role === 'teacher' || user.role === 'director') {
        const panel = document.getElementById('teacherPanel');
        if (panel) panel.style.display = 'block';
    }

    renderAvatar(user);
    renderGreeting(user);
    renderStats(user);
    renderTareas(user);
    renderMensajes(user);
    renderClasesHoy();
    renderEventos();
    updateNavBadges(user);
});
