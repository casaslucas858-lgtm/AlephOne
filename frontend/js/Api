// ============================================================
// AlephOne — api.js
// Capa de abstracción de datos.
// Fase 1: localStorage. Fase 2: swapear por Firebase/Supabase
// sin tocar ningún otro archivo.
// ============================================================

const AlephAPI = (() => {

    // ─── HELPERS INTERNOS ───────────────────────────────────

    function _get(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch {
            return null;
        }
    }

    function _set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function _now() {
        return new Date().toISOString();
    }

    function _id() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    // ─── AUTH ────────────────────────────────────────────────

    const Auth = {
        getCurrentUser() {
            const username = localStorage.getItem('aleph_current_user');
            if (!username) return null;
            const users = _get('aleph_users') || {};
            if (!users[username]) return null;
            return { username, ...users[username] };
        },

        login(username, password) {
            const users = _get('aleph_users') || {};
            const user = users[username];
            if (!user) return { ok: false, error: 'Usuario no encontrado' };
            if (user.password !== password) return { ok: false, error: 'Contraseña incorrecta' };
            localStorage.setItem('aleph_current_user', username);
            return { ok: true, user: { username, ...user } };
        },

        register(username, email, password, role = 'student') {
            const users = _get('aleph_users') || {};
            if (users[username]) return { ok: false, error: 'El usuario ya existe' };
            users[username] = {
                email,
                password,
                role,           // 'student' | 'teacher' | 'director'
                createdAt: _now(),
                avatar: null
            };
            _set('aleph_users', users);
            localStorage.setItem('aleph_current_user', username);
            return { ok: true };
        },

        logout() {
            localStorage.removeItem('aleph_current_user');
        },

        updateUser(username, data) {
            const users = _get('aleph_users') || {};
            if (!users[username]) return { ok: false };
            users[username] = { ...users[username], ...data };
            _set('aleph_users', users);
            return { ok: true };
        }
    };

    // ─── COMUNICACIÓN ────────────────────────────────────────

    const Comunicacion = {
        // Crear anuncio (docente/director)
        crear({ titulo, contenido, autor, curso, materia, tipo = 'anuncio' }) {
            const mensajes = _get('aleph_mensajes') || [];
            const nuevo = {
                id: _id(),
                titulo,
                contenido,
                autor,
                curso,
                materia,
                tipo,           // 'anuncio' | 'recordatorio' | 'urgente'
                fechaCreacion: _now(),
                leido: []       // array de usernames que lo leyeron
            };
            mensajes.push(nuevo);
            _set('aleph_mensajes', mensajes);
            return { ok: true, mensaje: nuevo };
        },

        // Obtener mensajes para un usuario
        getParaUsuario(username, curso = null) {
            const mensajes = _get('aleph_mensajes') || [];
            return mensajes
                .filter(m => !curso || m.curso === curso || m.curso === 'todos')
                .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
        },

        // Marcar como leído
        marcarLeido(mensajeId, username) {
            const mensajes = _get('aleph_mensajes') || [];
            const idx = mensajes.findIndex(m => m.id === mensajeId);
            if (idx === -1) return;
            if (!mensajes[idx].leido.includes(username)) {
                mensajes[idx].leido.push(username);
                _set('aleph_mensajes', mensajes);
            }
        },

        eliminar(mensajeId) {
            let mensajes = _get('aleph_mensajes') || [];
            mensajes = mensajes.filter(m => m.id !== mensajeId);
            _set('aleph_mensajes', mensajes);
        }
    };

    // ─── TAREAS (QUIZZIT) ────────────────────────────────────

    const Tareas = {
        crear({ titulo, descripcion, materia, curso, autor, fechaCierre, tipo = 'tarea' }) {
            const tareas = _get('aleph_tareas') || [];
            const nueva = {
                id: _id(),
                titulo,
                descripcion,
                materia,
                curso,
                autor,
                fechaCierre,    // ISO string
                tipo,           // 'tarea' | 'examen' | 'quiz'
                fechaCreacion: _now(),
                entregas: []    // [{ username, contenido, fecha, nota }]
            };
            tareas.push(nueva);
            _set('aleph_tareas', tareas);
            return { ok: true, tarea: nueva };
        },

        getParaCurso(curso) {
            const tareas = _get('aleph_tareas') || [];
            return tareas
                .filter(t => t.curso === curso || t.curso === 'todos')
                .sort((a, b) => new Date(a.fechaCierre) - new Date(b.fechaCierre));
        },

        getDelDocente(autor) {
            const tareas = _get('aleph_tareas') || [];
            return tareas.filter(t => t.autor === autor);
        },

        entregar({ tareaId, username, contenido }) {
            const tareas = _get('aleph_tareas') || [];
            const idx = tareas.findIndex(t => t.id === tareaId);
            if (idx === -1) return { ok: false, error: 'Tarea no encontrada' };
            const yaEntrego = tareas[idx].entregas.find(e => e.username === username);
            if (yaEntrego) return { ok: false, error: 'Ya entregaste esta tarea' };
            tareas[idx].entregas.push({
                username,
                contenido,
                fecha: _now(),
                nota: null
            });
            _set('aleph_tareas', tareas);
            return { ok: true };
        },

        calificar({ tareaId, username, nota }) {
            const tareas = _get('aleph_tareas') || [];
            const idx = tareas.findIndex(t => t.id === tareaId);
            if (idx === -1) return { ok: false };
            const entrega = tareas[idx].entregas.find(e => e.username === username);
            if (!entrega) return { ok: false };
            entrega.nota = nota;
            _set('aleph_tareas', tareas);
            return { ok: true };
        },

        eliminar(tareaId) {
            let tareas = _get('aleph_tareas') || [];
            tareas = tareas.filter(t => t.id !== tareaId);
            _set('aleph_tareas', tareas);
        }
    };

    // ─── HORARIO ─────────────────────────────────────────────

    const Horario = {
        // Obtener horario de un curso
        get(curso) {
            const horarios = _get('aleph_horarios') || {};
            return horarios[curso] || null;
        },

        // Guardar/actualizar horario de un curso
        // bloques: { lunes: [{hora:'08:00', materia:'Matemática', docente:'Prof. García'}], ... }
        guardar(curso, bloques) {
            const horarios = _get('aleph_horarios') || {};
            horarios[curso] = {
                curso,
                bloques,
                ultimaActualizacion: _now()
            };
            _set('aleph_horarios', horarios);
            return { ok: true };
        },

        // Agregar cambio puntual (reemplazo, cancelación)
        agregarCambio(curso, cambio) {
            const cambios = _get('aleph_cambios_horario') || [];
            cambios.push({
                id: _id(),
                curso,
                ...cambio,      // { fecha, tipo: 'cancelacion'|'reemplazo', materia, motivo }
                createdAt: _now()
            });
            _set('aleph_cambios_horario', cambios);
            return { ok: true };
        },

        getCambiosHoy(curso) {
            const cambios = _get('aleph_cambios_horario') || [];
            const hoy = new Date().toISOString().slice(0, 10);
            return cambios.filter(c => c.curso === curso && c.fecha === hoy);
        }
    };

    // ─── PROMEDIOS ───────────────────────────────────────────

    const Promedios = {
        // Guardar nota de un alumno en una materia
        guardarNota({ username, materia, tipo, valor, descripcion }) {
            const notas = _get('aleph_notas') || [];
            notas.push({
                id: _id(),
                username,
                materia,
                tipo,           // 'tarea' | 'examen' | 'participacion' | 'asistencia'
                valor,          // número 1-10
                descripcion,
                fecha: _now()
            });
            _set('aleph_notas', notas);
            return { ok: true };
        },

        // Obtener todas las notas de un alumno
        getDeAlumno(username) {
            const notas = _get('aleph_notas') || [];
            return notas.filter(n => n.username === username);
        },

        // Calcular promedio por materia
        calcularPromedio(username, materia) {
            const notas = _get('aleph_notas') || [];
            const filtradas = notas.filter(n => n.username === username && n.materia === materia);
            if (filtradas.length === 0) return null;
            const suma = filtradas.reduce((acc, n) => acc + n.valor, 0);
            return +(suma / filtradas.length).toFixed(2);
        },

        // Simulación: ¿qué nota necesito para llegar a X promedio?
        simular({ username, materia, promedioObjetivo }) {
            const notas = _get('aleph_notas') || [];
            const filtradas = notas.filter(n => n.username === username && n.materia === materia);
            if (filtradas.length === 0) return null;
            const suma = filtradas.reduce((acc, n) => acc + n.valor, 0);
            // nota_necesaria = objetivo * (n+1) - suma_actual
            const notaNecesaria = promedioObjetivo * (filtradas.length + 1) - suma;
            return +notaNecesaria.toFixed(2);
        }
    };

    // ─── CALENDARIO ──────────────────────────────────────────

    const Calendario = {
        agregar({ titulo, fecha, tipo, curso, descripcion }) {
            const eventos = _get('aleph_calendario') || [];
            eventos.push({
                id: _id(),
                titulo,
                fecha,          // 'YYYY-MM-DD'
                tipo,           // 'examen' | 'entrega' | 'evento' | 'feriado'
                curso,
                descripcion,
                createdAt: _now()
            });
            _set('aleph_calendario', eventos);
            return { ok: true };
        },

        getProximos(curso, dias = 7) {
            const eventos = _get('aleph_calendario') || [];
            const hoy = new Date();
            const limite = new Date(hoy.getTime() + dias * 86400000);
            return eventos
                .filter(e => {
                    const fecha = new Date(e.fecha);
                    return (e.curso === curso || e.curso === 'todos') &&
                           fecha >= hoy && fecha <= limite;
                })
                .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        },

        getDelMes(curso, year, month) {
            const eventos = _get('aleph_calendario') || [];
            return eventos.filter(e => {
                const f = new Date(e.fecha);
                return (e.curso === curso || e.curso === 'todos') &&
                       f.getFullYear() === year && f.getMonth() === month;
            });
        }
    };

    // ─── SEED (datos demo para testing) ─────────────────────

    function seedDemo() {
        if (_get('aleph_seeded')) return;

        // Usuario demo docente
        Auth.register('profe_demo', 'profe@aleph.com', '1234', 'teacher');
        // Usuario demo alumno
        Auth.register('alumno_demo', 'alumno@aleph.com', '1234', 'student');

        // Mensajes demo
        Comunicacion.crear({
            titulo: 'Bienvenidos a AlephOne',
            contenido: 'Esta es la plataforma oficial del curso. Acá van a encontrar todas las tareas, horarios y comunicados.',
            autor: 'profe_demo',
            curso: '3A',
            materia: 'General',
            tipo: 'anuncio'
        });

        Comunicacion.crear({
            titulo: 'Examen de Matemática el viernes',
            contenido: 'El viernes 11/4 hay examen de ecuaciones. Estudien del capítulo 4.',
            autor: 'profe_demo',
            curso: '3A',
            materia: 'Matemática',
            tipo: 'urgente'
        });

        // Tareas demo
        Tareas.crear({
            titulo: 'TP: Ecuaciones lineales',
            descripcion: 'Resolver los ejercicios 1 al 10 del capítulo 4. Mostrar procedimiento.',
            materia: 'Matemática',
            curso: '3A',
            autor: 'profe_demo',
            fechaCierre: new Date(Date.now() + 3 * 86400000).toISOString(),
            tipo: 'tarea'
        });

        Tareas.crear({
            titulo: 'Quiz: Revolución Francesa',
            descripcion: 'Quiz de 10 preguntas sobre causas y consecuencias.',
            materia: 'Historia',
            curso: '3A',
            autor: 'profe_demo',
            fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString(),
            tipo: 'quiz'
        });

        // Horario demo
        Horario.guardar('3A', {
            lunes:    [{ hora: '08:00', materia: 'Matemática', docente: 'Prof. García' }, { hora: '09:00', materia: 'Historia', docente: 'Prof. López' }],
            martes:   [{ hora: '08:00', materia: 'Lengua', docente: 'Prof. Martínez' }, { hora: '09:00', materia: 'Biología', docente: 'Prof. Sosa' }],
            miercoles:[{ hora: '08:00', materia: 'Matemática', docente: 'Prof. García' }, { hora: '09:00', materia: 'Física', docente: 'Prof. Ruiz' }],
            jueves:   [{ hora: '08:00', materia: 'Historia', docente: 'Prof. López' }, { hora: '09:00', materia: 'Inglés', docente: 'Prof. Smith' }],
            viernes:  [{ hora: '08:00', materia: 'Matemática', docente: 'Prof. García' }, { hora: '09:00', materia: 'Educación Física', docente: 'Prof. Torres' }]
        });

        // Notas demo
        Promedios.guardarNota({ username: 'alumno_demo', materia: 'Matemática', tipo: 'examen', valor: 8, descripcion: 'Primer parcial' });
        Promedios.guardarNota({ username: 'alumno_demo', materia: 'Matemática', tipo: 'tarea', valor: 9, descripcion: 'TP cap. 3' });
        Promedios.guardarNota({ username: 'alumno_demo', materia: 'Historia', tipo: 'examen', valor: 7, descripcion: 'Primer parcial' });

        // Eventos calendario demo
        Calendario.agregar({ titulo: 'Examen Matemática', fecha: new Date(Date.now() + 2 * 86400000).toISOString().slice(0,10), tipo: 'examen', curso: '3A', descripcion: 'Cap. 4 - Ecuaciones' });
        Calendario.agregar({ titulo: 'Entrega TP Historia', fecha: new Date(Date.now() + 5 * 86400000).toISOString().slice(0,10), tipo: 'entrega', curso: '3A', descripcion: 'Revolución Francesa' });

        _set('aleph_seeded', true);
        console.log('✓ AlephOne: datos demo cargados');
    }

    // ─── EXPORT ──────────────────────────────────────────────

    return {
        Auth,
        Comunicacion,
        Tareas,
        Horario,
        Promedios,
        Calendario,
        seedDemo
    };

})();
