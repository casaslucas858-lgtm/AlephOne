// ============================================================
// AlephOne — api.js — FASE 2: Supabase (Producción)
// ============================================================

const SUPABASE_URL = 'https://ikxvbmsvzmsiztxvzdtz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cN4exqC8p4r9Hg3ZQYWcWg_gLwcRdui';

// Inicialización del cliente
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const AlephAPI = (() => {

    function _now() { return new Date().toISOString(); }

    // ─── AUTH ────────────────────────────────────────────────
    const Auth = {
        getCurrentUser() {
            return window._alephUser || null;
        },

        async init() {
            const { data: { session } } = await _sb.auth.getSession();
            if (session?.user) await Auth._loadProfile(session.user);

            // Escuchar cambios de estado (login/logout)
            _sb.auth.onAuthStateChange(async (event, session) => {
                if (session?.user) {
                    await Auth._loadProfile(session.user);
                } else {
                    window._alephUser = null;
                }
            });
        },

        async _loadProfile(authUser) {
            const { data: profile } = await _sb
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single();

            // FIX: Si existe el usuario en Auth pero no tiene fila en Profiles (error de registro parcial)
            if (!profile) {
                console.warn("Perfil no encontrado para el usuario activo. Cerrando sesión...");
                await _sb.auth.signOut();
                window._alephUser = null;
                return;
            }

            window._alephUser = {
                id: authUser.id,
                email: authUser.email,
                username: profile.username || authUser.email.split('@')[0],
                role: profile.role || 'student',
                curso: profile.curso || '3A'
            };
        },

        async login(username, password) {
            const safeUsername = username.replace(/[^a-zA-Z0-9_.]/g, '');
            const email = `${safeUsername}@alephone.app`;
            
            const { data, error } = await _sb.auth.signInWithPassword({ email, password });
            
            if (error) return { ok: false, error: 'Usuario o contraseña incorrectos' };
            
            await Auth._loadProfile(data.user);
            return { ok: true };
        },

        async register(username, emailReal, password, role = 'student') {
            const safeUsername = username.replace(/[^a-zA-Z0-9_.]/g, '');
            if (safeUsername.length < 3) return { ok: false, error: 'El usuario es muy corto' };

            const { data: existing } = await _sb
                .from('profiles')
                .select('id')
                .eq('username', safeUsername)
                .single();
            
            if (existing) return { ok: false, error: 'El nombre de usuario ya está registrado' };

            const authEmail = `${safeUsername}@alephone.app`;

            const { data, error } = await _sb.auth.signUp({
                email: authEmail,
                password,
                options: { 
                    data: { display_name: safeUsername, role: role } 
                }
            });

            if (error) return { ok: false, error: error.message };

            if (data.user) {
                const { error: profileError } = await _sb.from('profiles').insert({
                    id: data.user.id,
                    username: safeUsername,
                    role: role,
                    email_real: emailReal,
                    curso: '3A'
                });

                if (profileError) {
                    console.error("Error crítico creando perfil:", profileError);
                    // Opcional: podrías borrar el usuario de Auth aquí para limpieza total
                    return { ok: false, error: "Error al crear el perfil de usuario" };
                }
                await Auth._loadProfile(data.user);
            }

            return { ok: true };
        },

        async logout() {
            await _sb.auth.signOut();
            window._alephUser = null;
            location.href = 'index.html';
        }
    };

    // ─── COMUNICACIÓN ────────────────────────────────────────
    const Comunicacion = {
        async crear({ titulo, contenido, autor, curso, materia, tipo = 'anuncio' }) {
            const user = Auth.getCurrentUser();
            const { data, error } = await _sb.from('mensajes').insert({
                titulo, contenido,
                autor_id: user.id, autor_username: autor,
                curso, materia, tipo
            }).select().single();
            if (error) return { ok: false, error: error.message };
            return { ok: true, mensaje: data };
        },

        async getParaUsuario(username, curso = null) {
            let query = _sb.from('mensajes').select('*').order('created_at', { ascending: false });
            if (curso) query = query.eq('curso', curso);
            const { data } = await query;

            const user = Auth.getCurrentUser();
            const { data: leidos } = await _sb
                .from('mensajes_leidos').select('mensaje_id').eq('user_id', user.id);
            const leidosSet = new Set((leidos || []).map(l => l.mensaje_id));

            return (data || []).map(m => ({
                ...m,
                fechaCreacion: m.created_at,
                autor: m.autor_username,
                leido: leidosSet.has(m.id) ? [username] : []
            }));
        },

        async marcarLeido(mensajeId) {
            const user = Auth.getCurrentUser();
            if (!user) return;
            await _sb.from('mensajes_leidos')
                .upsert({ mensaje_id: mensajeId, user_id: user.id });
        },

        async eliminar(mensajeId) {
            const { error } = await _sb.from('mensajes').delete().eq('id', mensajeId);
            return !error;
        }
    };

    // ─── TAREAS ──────────────────────────────────────────────
    const Tareas = {
        async crear({ titulo, descripcion, materia, curso, autor, fechaCierre, tipo = 'tarea' }) {
            const user = Auth.getCurrentUser();
            const { data, error } = await _sb.from('tareas').insert({
                titulo, descripcion, materia, curso,
                autor_id: user.id, autor_username: autor,
                fecha_cierre: fechaCierre, tipo
            }).select().single();
            if (error) return { ok: false, error: error.message };
            return { ok: true, tarea: data };
        },

        async getParaCurso(curso) {
            const { data } = await _sb
                .from('tareas').select('*, entregas(*)')
                .eq('curso', curso).order('fecha_cierre', { ascending: true });
            return (data || []).map(t => ({ 
                ...t, 
                fechaCierre: t.fecha_cierre, 
                entregas: t.entregas || [] 
            }));
        },

        async entregar({ tareaId, username, contenido }) {
            const user = Auth.getCurrentUser();
            const { error } = await _sb.from('entregas').insert({
                tarea_id: tareaId, 
                alumno_id: user.id,
                alumno_username: username, 
                contenido
            });
            if (error) {
                if (error.code === '23505') return { ok: false, error: 'Ya entregaste esta tarea' };
                return { ok: false, error: error.message };
            }
            return { ok: true };
        },

        async calificar({ tareaId, alumnoId, nota }) {
            const { error } = await _sb.from('entregas')
                .update({ nota })
                .eq('tarea_id', tareaId).eq('alumno_id', alumnoId);
            return error ? { ok: false } : { ok: true };
        }
    };

    // ─── HORARIO ─────────────────────────────────────────────
    const Horario = {
        async get(curso) {
            const { data } = await _sb.from('horarios').select('*').eq('curso', curso).single();
            return data || null;
        },

        async guardar(curso, bloques) {
            const { error } = await _sb.from('horarios')
                .upsert({ curso, bloques, updated_at: _now() }, { onConflict: 'curso' });
            return error ? { ok: false } : { ok: true };
        },

        async agregarCambio(curso, cambio) {
            const { error } = await _sb.from('cambios_horario').insert({ curso, ...cambio });
            return error ? { ok: false } : { ok: true };
        },

        async getCambiosHoy(curso) {
            const hoy = new Date().toISOString().slice(0, 10);
            const { data } = await _sb.from('cambios_horario')
                .select('*').eq('curso', curso).eq('fecha', hoy);
            return data || [];
        }
    };

    // ─── PROMEDIOS ───────────────────────────────────────────
    const Promedios = {
        async guardarNota({ username, materia, tipo, valor, descripcion }) {
            const user = Auth.getCurrentUser();
            const { error } = await _sb.from('notas').insert({
                alumno_id: user.id, 
                alumno_username: username,
                materia, tipo, valor, descripcion
            });
            return error ? { ok: false } : { ok: true };
        },

        async getDeAlumno(username) {
            const { data } = await _sb.from('notas')
                .select('*').eq('alumno_username', username)
                .order('created_at', { ascending: false });
            return (data || []).map(n => ({ ...n, fecha: n.created_at }));
        }
    };

    // ─── CALENDARIO ──────────────────────────────────────────
    const Calendario = {
        async getProximos(curso, dias = 7) {
            const hoy = new Date().toISOString().slice(0, 10);
            const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
            const { data } = await _sb.from('eventos').select('*')
                .or(`curso.eq.${curso},curso.eq.todos`)
                .gte('fecha', hoy).lte('fecha', limite)
                .order('fecha', { ascending: true });
            return data || [];
        }
    };

    return { Auth, Comunicacion, Tareas, Horario, Promedios, Calendario };

})();

document.addEventListener('DOMContentLoaded', () => AlephAPI.Auth.init());
