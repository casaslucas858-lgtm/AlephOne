// ============================================================
// AlephOne - api.js - FASE 2: Supabase (Produccion)
// ============================================================

const SUPABASE_URL = 'https://ikxvbmsvzmsiztxvzdtz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cN4exqC8p4r9Hg3ZQYWcWg_gLwcRdui';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const AlephAPI = (() => {

    function _now() { return new Date().toISOString(); }
    function _defaultCurso() { return '3A'; }

    function _isNoRowsError(error) {
        return error?.code === 'PGRST116' || error?.details?.includes('0 rows');
    }

    function _isUniqueViolation(error) {
        return error?.code === '23505';
    }

    function _authMessage(error, fallback = 'Ocurrio un error inesperado') {
        const msg = error?.message || '';

        if (error?.code === 'user_already_exists' || msg.includes('already registered')) {
            return 'El correo ya esta registrado';
        }
        if (msg.includes('Password should be at least 6 characters')) {
            return 'La contrasena debe tener al menos 6 caracteres';
        }
        if (msg.includes('Invalid login credentials')) {
            return 'Usuario o contrasena incorrectos';
        }
        if (msg.includes('Email not confirmed')) {
            return 'Tenes que confirmar tu correo antes de ingresar';
        }

        return msg || fallback;
    }

    function _profilePayload(authUser, overrides = {}) {
        const meta = authUser?.user_metadata || {};
        const email = overrides.email_real || authUser?.email || meta.email || null;
        const username = overrides.username || meta.username || (email ? email.split('@')[0] : null);

        return {
            id: authUser.id,
            username,
            role: overrides.role || meta.role || 'student',
            email_real: email,
            curso: overrides.curso || meta.curso || _defaultCurso()
        };
    }

    function _setCurrentUser(authUser, profile) {
        window._alephUser = {
            id: authUser.id,
            email: authUser.email,
            username: profile.username || authUser.email.split('@')[0],
            role: profile.role || 'student',
            curso: profile.curso || _defaultCurso()
        };
    }

    // --- AUTH ------------------------------------------------
    const Auth = {
        getCurrentUser() {
            return window._alephUser || null;
        },

        async init() {
            const { data: { session } } = await _sb.auth.getSession();
            if (session?.user) await Auth._loadProfile(session.user);

            _sb.auth.onAuthStateChange(async (event, session) => {
                if (session?.user) await Auth._loadProfile(session.user);
                else window._alephUser = null;
            });
        },

        async _getProfileById(userId) {
            const { data, error } = await _sb
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (error && !_isNoRowsError(error)) {
                return { ok: false, error };
            }

            return { ok: true, profile: data || null };
        },

        async _ensureProfile(authUser, overrides = {}) {
            const current = await Auth._getProfileById(authUser.id);
            if (!current.ok) return current;
            if (current.profile) return current;

            const payload = _profilePayload(authUser, overrides);
            const { error: insertError } = await _sb.from('profiles').insert(payload);

            if (insertError && !_isUniqueViolation(insertError)) {
                return { ok: false, error: insertError };
            }

            const afterInsert = await Auth._getProfileById(authUser.id);
            if (afterInsert.ok && afterInsert.profile) return afterInsert;

            if (_isUniqueViolation(insertError)) {
                return {
                    ok: false,
                    error: {
                        ...insertError,
                        message: 'El perfil no se pudo sincronizar porque el usuario o el correo ya existen.'
                    }
                };
            }

            return {
                ok: false,
                error: afterInsert.error || { message: 'No se pudo recuperar el perfil del usuario.' }
            };
        },

        async _loadProfile(authUser) {
            const ensured = await Auth._ensureProfile(authUser, {
                username: authUser?.user_metadata?.username,
                role: authUser?.user_metadata?.role,
                email_real: authUser?.email,
                curso: authUser?.user_metadata?.curso || _defaultCurso()
            });

            if (!ensured.ok || !ensured.profile) {
                console.error('No se pudo cargar el perfil del usuario:', ensured.error);
                window._alephUser = null;
                return { ok: false, error: ensured.error };
            }

            _setCurrentUser(authUser, ensured.profile);
            return { ok: true, profile: ensured.profile };
        },

        async login(usernameOrEmail, password) {
            let email = usernameOrEmail;

            if (!usernameOrEmail.includes('@')) {
                const { data: profile, error: pError } = await _sb
                    .from('profiles')
                    .select('email_real')
                    .eq('username', usernameOrEmail)
                    .maybeSingle();

                if (pError && !_isNoRowsError(pError)) {
                    return { ok: false, error: 'No se pudo verificar el usuario. Revisa la configuracion de perfiles.' };
                }
                if (!profile?.email_real) {
                    return { ok: false, error: 'Usuario no encontrado' };
                }

                email = profile.email_real;
            }

            const { data, error } = await _sb.auth.signInWithPassword({ email, password });
            if (error) return { ok: false, error: _authMessage(error, 'No se pudo iniciar sesion') };

            const loaded = await Auth._loadProfile(data.user);
            if (!loaded.ok) {
                return { ok: false, error: 'La cuenta existe, pero no se pudo cargar el perfil.' };
            }

            return { ok: true };
        },

        async register(username, email, password, role = 'student') {
            const { data: existing, error: existingError } = await _sb
                .from('profiles')
                .select('id')
                .eq('username', username)
                .maybeSingle();

            if (existingError && !_isNoRowsError(existingError)) {
                return { ok: false, error: 'No se pudo validar el nombre de usuario.' };
            }
            if (existing) {
                return { ok: false, error: 'El nombre de usuario ya existe' };
            }

            const { data, error } = await _sb.auth.signUp({
                email,
                password,
                options: { data: { username, role, curso: _defaultCurso() } }
            });

            if (error) {
                await _sb.auth.signOut();
                return { ok: false, error: _authMessage(error, 'No se pudo crear la cuenta') };
            }

            let authUser = data.user;

            if (!data.session && authUser) {
                const { data: loginData, error: loginError } = await _sb.auth.signInWithPassword({ email, password });
                if (loginError) {
                    return { ok: false, error: 'La cuenta fue creada, pero no se pudo iniciar sesion automaticamente.' };
                }
                authUser = loginData.user;
            }

            if (!authUser) {
                return { ok: false, error: 'La cuenta se creo de forma incompleta. Intenta ingresar con tu correo.' };
            }

            const ensured = await Auth._ensureProfile(authUser, {
                username,
                role,
                email_real: email,
                curso: _defaultCurso()
            });

            if (!ensured.ok || !ensured.profile) {
                console.error('Error creando/sincronizando perfil:', ensured.error);
                await _sb.auth.signOut();
                return { ok: false, error: 'La cuenta fue creada, pero el perfil no se pudo sincronizar.' };
            }

            _setCurrentUser(authUser, ensured.profile);
            return { ok: true };
        },

        async logout() {
            await _sb.auth.signOut();
            window._alephUser = null;
            location.href = './index.html';
        }
    };

    // --- COMUNICACION ----------------------------------------
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

    // --- TAREAS ----------------------------------------------
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
                ...t, fechaCierre: t.fecha_cierre, entregas: t.entregas || []
            }));
        },

        async getDelDocente(autorUsername) {
            const { data } = await _sb
                .from('tareas').select('*, entregas(*)')
                .eq('autor_username', autorUsername).order('fecha_cierre', { ascending: true });
            return (data || []).map(t => ({
                ...t, fechaCierre: t.fecha_cierre, entregas: t.entregas || []
            }));
        },

        async entregar({ tareaId, username, contenido }) {
            const user = Auth.getCurrentUser();
            const { error } = await _sb.from('entregas').insert({
                tarea_id: tareaId, alumno_id: user.id,
                alumno_username: username, contenido
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
        },

        async eliminar(tareaId) {
            await _sb.from('tareas').delete().eq('id', tareaId);
        }
    };

    // --- HORARIO ---------------------------------------------
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

    // --- PROMEDIOS -------------------------------------------
    const Promedios = {
        async guardarNota({ username, materia, tipo, valor, descripcion }) {
            const user = Auth.getCurrentUser();
            const { error } = await _sb.from('notas').insert({
                alumno_id: user.id, alumno_username: username,
                materia, tipo, valor, descripcion
            });
            return error ? { ok: false } : { ok: true };
        },

        async getDeAlumno(username) {
            const { data } = await _sb.from('notas')
                .select('*').eq('alumno_username', username)
                .order('created_at', { ascending: false });
            return (data || []).map(n => ({ ...n, fecha: n.created_at }));
        },

        // Helpers sincronos - reciben el array de notas ya cargado
        calcularPromedio(notas, materia) {
            const f = notas.filter(n => n.materia === materia);
            if (!f.length) return null;
            return +(f.reduce((a, n) => a + Number(n.valor), 0) / f.length).toFixed(2);
        },

        simular({ notas, materia, promedioObjetivo }) {
            const f = notas.filter(n => n.materia === materia);
            if (!f.length) return null;
            const suma = f.reduce((a, n) => a + Number(n.valor), 0);
            return +(promedioObjetivo * (f.length + 1) - suma).toFixed(2);
        }
    };

    // --- CALENDARIO ------------------------------------------
    const Calendario = {
        async agregar({ titulo, fecha, tipo, curso, descripcion }) {
            const { error } = await _sb.from('eventos').insert({ titulo, fecha, tipo, curso, descripcion });
            return error ? { ok: false } : { ok: true };
        },

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
