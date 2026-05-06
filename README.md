# AlephOne

**Plataforma educativa integral para escuelas, docentes y estudiantes.**

> *"what homework?"*

---

## ¿Qué es AlephOne?

AlephOne organiza la vida escolar en un solo lugar. Sin WhatsApp fragmentado, sin papeles perdidos, sin grupos paralelos. Un sistema claro para docentes, directores y estudiantes.

**Problema que resuelve:**
- Fragmentación de información entre WhatsApp, mails, papeles y grupos
- Sobrecarga y confusión de tareas para estudiantes
- Falta de control y visibilidad para docentes y directores

---

## 🔗 Demo

**MVP (próximamente):** `https://casaslucas858-lgtm.github.io/AlephOne/frontend/index.html`

---

## 👥 Usuarios

| Rol | Descripción |
|-----|-------------|
| **Docente** | Crea tareas, gestiona comunicación, edita horarios, registra notas |
| **Director** | Visión institucional, comunicados globales |
| **Estudiante** | Recibe info, entrega tareas, consulta horario y promedios |

---

## 🎯 MVP — Funciones actuales

- ✅ Autenticación por rol (docente / estudiante)
- ✅ Dashboard "Qué hago hoy"
- ✅ Comunicación docente ↔ alumno
- ✅ Tareas con fecha de cierre (Quizzit)
- ✅ Horario editable
- ✅ Calculadora de promedios
- ✅ Fractal AI chat

---

## 🗺️ Roadmap

**Fase 1 — MVP Frontend** *(actual)*
Frontend-only con localStorage. Demo funcional para mostrar a escuelas.

**Fase 2 — Backend**
Firebase / Supabase. Usuarios reales, sincronización entre dispositivos, comunicación real.

**Fase 3 — MVP+**
Competencias entre grados, inner chats, banco de preguntas.

---

## 🛠️ Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML, CSS, JavaScript vanilla |
| Storage (fase 1) | localStorage |
| Backend (fase 2) | Firebase / Supabase |
| Deploy | GitHub Pages → dominio propio |
| AI | Anthropic Claude API (Fractal AI chat) |

---

## 📂 Estructura

```
AlephOne/
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── api.js          ← capa de abstracción (localStorage → backend)
│   │   ├── app.js          ← core, auth, routing
│   │   ├── dashboard.js
│   │   ├── tareas.js
│   │   ├── horario.js
│   │   ├── promedios.js
│   │   ├── comunicacion.js
│   │   └── ai-chat.js
│   ├── data/
│   ├── index.html
│   ├── dashboard.html
│   ├── tareas.html
│   ├── horario.html
│   ├── promedios.html
│   ├── comunicacion.html
│   └── ai-chat.html
├── backend/                ← próximamente
├── .gitignore
├── LICENSE
└── README.md
```

---

---

## 🚀 Correr localmente

```bash
git clone https://github.com/casaslucas858-lgtm/AlephOne.git
cd AlephOne/frontend
# Abrir index.html en el navegador
# O usar Live Server en VS Code
```

---

## 📜 Licencia

MIT License — Proyecto educativo abierto.

---

## 👤 Autor

**Lucas (ishemluks)** — Estudiante de secundaria, La Rioja, Argentina.
Competidor ATACALAR, Canguro Matemático.

---
made by luks with medium effort

*AlephOne nació del caos escolar real. Construido para resolverlo.*
