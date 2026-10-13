# Despliegue

## Cómo funciona

- Frontend y backend son **dos proyectos de Vercel** separados.
- Cada `git push` a `physoft_web` (o a `main`) ejecuta `.github/workflows/deploy-vercel.yml`.
- El workflow detecta qué carpeta cambió y despliega en producción solo esa parte: `frontend/**`, `backend/**` o ambas.
- Un cambio que solo toca la raíz o `docs/` no despliega nada.

Secrets que necesita el repositorio en GitHub (Settings → Secrets → Actions):

| Secret | Uso |
| --- | --- |
| `VERCEL_TOKEN` | Token de la cuenta de Vercel |
| `VERCEL_ORG_ID` | Equipo/organización de Vercel |
| `VERCEL_PROJECT_ID_BACKEND` | Proyecto del backend |
| `VERCEL_PROJECT_ID_FRONTEND` | Proyecto del frontend |

## Proyecto backend (Vercel)

- Root Directory: `backend`. `backend/vercel.json` sirve `src/index.ts` como función serverless con `@vercel/node`; todas las rutas van a la app Express.
- Variables de entorno: los nombres están en `backend/.env.example`; los valores se cargan solo en Vercel.

| Variable | Para qué sirve |
| --- | --- |
| `DATABASE_URL` | PostgreSQL de Supabase |
| `NODE_ENV`, `PORT` | Entorno de ejecución |
| `CORS_ORIGINS` | URL(s) del frontend permitidas |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Firma y duración de la sesión |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Usuario admin que crea `seed:admin` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Fotos e imágenes de evidencia |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Autocompletado y análisis de texto con IA |
| `CHAT_ANTHROPIC_MODEL` | Modelo del asistente clínico |
| `AI_PROVIDER`, `OPENAI_*`, `GEMINI_*` | Proveedores alternativos heredados (opcionales) |

## Proyecto frontend (Vercel)

- Root Directory: `frontend`, preset Vite. `frontend/vercel.json` redirige todas las rutas a la SPA.
- Variable de entorno: `VITE_API_URL=https://<backend>.vercel.app/api`.
- Todo lo que empieza con `VITE_` termina en el bundle público: nunca poner claves ahí.

## Migraciones de base de datos

- Las migraciones viven en `backend/prisma/migrations`. En producción se aplican con `npm run db:deploy` (`prisma migrate deploy`), nunca con `migrate dev` ni `migrate reset`.
- Antes de correr cualquier comando de Prisma, confirmar a qué base apunta `DATABASE_URL`: el `.env` local puede apuntar a producción.
- Probar las migraciones primero en una base de desarrollo. `prisma migrate status` debe decir "up to date" después de aplicarlas.
- La migración `20260714120000` se marcó como aplicada sin ejecutarla, porque sus cambios ya existían en producción.

## Seguridad

- Ningún secreto va en el repositorio. `.env` y `.claude/settings*.json` están ignorados por git.
- Si un secreto llega a un commit, hay que **rotarlo**: borrarlo del archivo no lo saca del historial de git.
