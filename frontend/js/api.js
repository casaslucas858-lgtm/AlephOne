        }
    };

    return { Auth, Comunicacion, Tareas, Horario, Promedios, Calendario };
    // --- QUIZ ------------------------------------------------
    const Quiz = {
        async crear({ titulo, descripcion, curso }) {
            const user = Auth.getCurrentUser();
            const { data, error } = await _sb.from('quizzes').insert({
                titulo,
                descripcion,
                curso,
                autor_id: user.id,
                autor_username: user.username
            }).select().single();
            if (error) return { ok: false, error: error.message };
            return { ok: true, quiz: data };
        },

        async getDelDocente(autorUsername) {
            const { data } = await _sb
                .from('quizzes')
                .select('*, preguntas(*)')
                .eq('autor_username', autorUsername)
                .order('created_at', { ascending: false });
            return data || [];
        },

        async getParaCurso(curso) {
            const { data } = await _sb
                .from('quizzes')
                .select('*')
                .eq('curso', curso)
                .order('created_at', { ascending: false });
            return data || [];
        },

        async eliminar(quizId) {
            const { error } = await _sb.from('quizzes').delete().eq('id', quizId);
            return !error;
        }
    };

    // --- PREGUNTAS -------------------------------------------
    const Preguntas = {
        async crear({ quizId, orden, tipo, enunciado, opciones, respuestaCorrecta, tiempoSegundos, puntos }) {
            const { data, error } = await _sb.from('preguntas').insert({
                quiz_id: quizId,
                orden,
                tipo,
                enunciado,
                opciones,
                respuesta_correcta: respuestaCorrecta,
                tiempo_segundos: tiempoSegundos,
                puntos
            }).select().single();
            if (error) return { ok: false, error: error.message };
            return { ok: true, pregunta: data };
        },

        async getDeQuiz(quizId) {
            const { data } = await _sb
                .from('preguntas')
                .select('*')
                .eq('quiz_id', quizId)
                .order('orden', { ascending: true });
            return data || [];
        },

        async actualizar(preguntaId, campos) {
            const payload = {};
            const map = {
                quizId: 'quiz_id',
                respuestaCorrecta: 'respuesta_correcta',
                tiempoSegundos: 'tiempo_segundos'
            };

            Object.entries(campos || {}).forEach(([key, value]) => {
                payload[map[key] || key] = value;
            });

            const { data, error } = await _sb
                .from('preguntas')
                .update(payload)
                .eq('id', preguntaId)
                .select()
                .single();
            if (error) return { ok: false, error: error.message };
            return { ok: true, pregunta: data };
        },

        async eliminar(preguntaId) {
            const { error } = await _sb.from('preguntas').delete().eq('id', preguntaId);
            return !error;
        }
    };

    // --- SALA ------------------------------------------------
    const Sala = {
        async crear({ quizId, modo }) {
            const user = Auth.getCurrentUser();
            const { data: codigo, error: codigoError } = await _sb.rpc('generar_codigo_sala');
            if (codigoError) return { ok: false, error: codigoError.message };

            const { data, error } = await _sb.from('salas').insert({
                quiz_id: quizId,
                modo,
                host_id: user.id,
                codigo,
                estado: 'waiting'
            }).select().single();
            if (error) return { ok: false, error: error.message };
            return { ok: true, sala: data };
        },

        async getByCode(codigo) {
            const { data, error } = await _sb
                .from('salas')
                .select('*, quizzes(*, preguntas(*))')
                .eq('codigo', codigo)
                .neq('estado', 'finalizado')
                .maybeSingle();
            if (error && !_isNoRowsError(error)) return { ok: false, error: error.message };
            return { ok: true, sala: data || null };
        },

        async actualizarEstado({ salaId, estado, preguntaActual }) {
            const { data, error } = await _sb
                .from('salas')
                .update({ estado, pregunta_actual: preguntaActual })
                .eq('id', salaId)
                .select()
                .single();
            if (error) return { ok: false, error: error.message };
            return { ok: true, sala: data };
        },

        async unirse({ salaId, username }) {
            const user = Auth.getCurrentUser();
            const { data, error } = await _sb.from('participantes_sala').upsert({
                sala_id: salaId,
                user_id: user.id,
                username,
                puntaje: 0
            }, { onConflict: 'sala_id,user_id' }).select().single();
            if (error) return { ok: false, error: error.message };
            return { ok: true, participante: data };
        },

        async getParticipantes(salaId) {
            const { data } = await _sb
                .from('participantes_sala')
                .select('*')
                .eq('sala_id', salaId)
                .order('puntaje', { ascending: false });
            return data || [];
        },

        async responder({ salaId, preguntaId, respuesta, esCorrecta, tiempoMs, puntosGanados }) {
            const user = Auth.getCurrentUser();
            const { data, error } = await _sb.from('respuestas_live').insert({
                sala_id: salaId,
                pregunta_id: preguntaId,
                user_id: user.id,
                respuesta,
                es_correcta: esCorrecta,
                tiempo_respuesta_ms: tiempoMs,
                puntos_ganados: puntosGanados
            }).select().single();
            if (error) return { ok: false, error: error.message };
            return { ok: true, respuesta: data };
        },

        async actualizarPuntaje({ salaId, userId, puntosExtra }) {
            const { data: participante, error: getError } = await _sb
                .from('participantes_sala')
                .select('puntaje')
                .eq('sala_id', salaId)
                .eq('user_id', userId)
                .single();

            if (getError) return { ok: false, error: getError.message };

            const { data, error } = await _sb
                .from('participantes_sala')
                .update({ puntaje: Number(participante.puntaje || 0) + Number(puntosExtra || 0) })
                .eq('sala_id', salaId)
                .eq('user_id', userId)
                .select()
                .single();
            if (error) return { ok: false, error: error.message };
            return { ok: true, participante: data };
        },

        async getRespuestasDePregunta(salaId, preguntaId) {
            const { data } = await _sb
                .from('respuestas_live')
                .select('*')
                .eq('sala_id', salaId)
                .eq('pregunta_id', preguntaId);
            return data || [];
        },

        suscribirSala(salaId, callback) {
            return _sb.channel(`sala:${salaId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'salas',
                    filter: `id=eq.${salaId}`
                }, callback)
                .subscribe();
        },

        suscribirRespuestas(salaId, callback) {
            return _sb.channel(`respuestas:${salaId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'respuestas_live',
                    filter: `sala_id=eq.${salaId}`
                }, callback)
                .subscribe();
        },

        suscribirParticipantes(salaId, callback) {
            return _sb.channel(`participantes:${salaId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'participantes_sala',
                    filter: `sala_id=eq.${salaId}`
                }, callback)
                .subscribe();
        }
    };

    // --- ASIGNACION ------------------------------------------
    const Asignacion = {
        async crear({ quizId, curso, fechaCierre }) {
            const user = Auth.getCurrentUser();
            const { data, error } = await _sb.from('asignaciones_quiz').insert({
                quiz_id: quizId,
                curso,
                fecha_cierre: fechaCierre,
                autor_id: user.id
            }).select().single();
            if (error) return { ok: false, error: error.message };
            return { ok: true, asignacion: data };
        },

        async getParaCurso(curso) {
            const { data } = await _sb
                .from('asignaciones_quiz')
                .select('*, quizzes(*, preguntas(*))')
                .eq('curso', curso)
                .order('created_at', { ascending: false });
            return data || [];
        },

        async getDelDocente(autorId) {
            const { data } = await _sb
                .from('asignaciones_quiz')
                .select('*, quizzes(*, preguntas(*))')
                .eq('autor_id', autorId)
                .order('created_at', { ascending: false });
            return data || [];
        },

        async responder({ asignacionId, respuestas, puntaje }) {
            const user = Auth.getCurrentUser();
            const { data, error } = await _sb.from('respuestas_asignadas').upsert({
                asignacion_id: asignacionId,
                user_id: user.id,
                respuestas,
                puntaje,
                completado_at: _now()
            }, { onConflict: 'asignacion_id,user_id' }).select().single();
            if (error) return { ok: false, error: error.message };
            return { ok: true, resultado: data };
        },

        async getResultados(asignacionId) {
            const { data } = await _sb
                .from('respuestas_asignadas')
                .select('*')
                .eq('asignacion_id', asignacionId);
            return data || [];
        }
    };

    return { Auth, Comunicacion, Tareas, Horario, Promedios, Calendario, Quiz, Preguntas, Sala, Asignacion };

})();
