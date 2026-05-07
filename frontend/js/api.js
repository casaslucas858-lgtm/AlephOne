// ============================================================
// AlephOne - api.js - FASE 2: Supabase (Produccion)
// ============================================================

const SUPABASE_URL = 'https://ikxvbmsvzmsiztxvzdtz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cN4exqC8p4r9Hg3ZQYWcWg_gLwcRdui';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let _authInitPromise = null;
let _authListenerBound = false;

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
            if (_authInitPromise) return _authInitPromise;

            _authInitPromise = (async () => {
                const { data: { session } } = await _sb.auth.getSession();
                if (session?.user) await Auth._loadProfile(session.user);
                else window._alephUser = null;

                if (!_authListenerBound) {
                    _sb.auth.onAuthStateChange(async (event, session) => {
                        if (session?.user) await Auth._loadProfile(session.user);
                        else window._alephUser = null;
                    });
                    _authListenerBound = true;
                }
            })();

            return _authInitPromise;
        },

        async _getProfileById(userId) {
            const { data, error } = await _sb
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
