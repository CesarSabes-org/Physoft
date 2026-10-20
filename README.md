# Physoft

Plataforma web de evaluación clínica y deportiva de pacientes para fisioterapeutas y kinesiólogos:
expedientes de pacientes, evaluaciones con resultados medidos, reporte clínico con reglas
reproducibles, exportación a PDF, autocompletado de resultados con IA y un asistente clínico.

- **Producción:** dos proyectos en Vercel (frontend y backend) desplegados desde la rama `main`.
- **Idioma:** la interfaz está en inglés; la documentación del equipo, en español.

## Tecnologías

| Capa | Stack |
| --- | --- |
| Frontend (`frontend/`) | React 18, TypeScript, Vite 6, React Router 6, Zustand, Recharts, Axios, jsPDF + html-to-image (PDF) |
| Backend (`backend/`) | Node.js, Express 4, TypeScript, Prisma 5, JWT, Multer, Helmet |
| Datos | PostgreSQL en Supabase · imágenes en Cloudinary |
| IA | API de Anthropic (autocompletado de resultados y asistente clínico) |
| Despliegue | Vercel + GitHub Actions (`.github/workflows/deploy-vercel.yml`) |
| Pruebas | Vitest y Playwright (frontend), `node --test` (backend) |

## Estructura

```
Physoft/
├── frontend/          SPA en React (páginas, componentes del reporte, utils de puntuación clínica)
├── backend/           API REST en capas: domain / application / infrastructure / presentation
│   └── prisma/        schema.prisma, migraciones y seed del usuario admin
├── docs/              Estado del proyecto, despliegue y documentación del chatbot
├── .github/workflows/ Despliegue automático a Vercel
├── AGENTS.md          Instrucciones para agentes de código (Codex / Claude)
└── package.json       Scripts para trabajar con frontend y backend a la vez
```

## Desarrollo local

Requisitos: Node.js 20+ y acceso a una base de datos PostgreSQL de **desarrollo**.

```bash
npm install          # instala la raíz, frontend y backend
cp backend/.env.example backend/.env      # completar valores
cp frontend/.env.example frontend/.env    # VITE_API_URL=http://localhost:3000/api
npm run dev          # backend en :3000 y frontend en :5173
```

> ⚠️ `backend/.env` puede apuntar a la base de producción. `npm run dev` en el backend ejecuta
> antes `seed:admin` sobre la base configurada; revisa `DATABASE_URL` antes de arrancar y nunca
> corras migraciones de prueba contra producción.

Comandos útiles:

| Dónde | Comando | Qué hace |
| --- | --- | --- |
| raíz | `npm run dev` | Backend y frontend juntos (también `run-dev.bat` / `run-dev.sh`) |
| raíz | `npm run build` | Compila backend y frontend |
| `backend` | `npm run build` | `prisma generate` + `tsc` |
| `backend` | `npm run prisma:studio` | Explorador visual de la base |
| `backend` | `npm run test:chat` | Pruebas del chatbot |
| `frontend` | `npm run build` | `tsc` + build de Vite |
| `frontend` | `npm run test:chat` / `test:chat:e2e` | Pruebas del chatbot (Vitest / Playwright) |

## Documentación

- [Estado del proyecto](docs/PROJECT_STATUS.md): funcionalidades, decisiones clínicas, pendientes y bugs conocidos.
- [Despliegue](docs/DEPLOYMENT.md): Vercel, GitHub Actions, variables de entorno y migraciones.
- [Chatbot: funcionamiento](docs/CHATBOT_SETUP.md) y [plan de implementación](docs/CHATBOT_IMPLEMENTATION_PLAN.md).

## Flujo de trabajo

- Rama de trabajo y producción: `main`. Cada push despliega solo la parte que cambió
  (frontend y/o backend).
- La versión de escritorio anterior (Electron) quedó guardada en el tag `legacy-desktop-electron`.
- Nunca subir secretos: `.env` y `.claude/settings*.json` están en `.gitignore`.
