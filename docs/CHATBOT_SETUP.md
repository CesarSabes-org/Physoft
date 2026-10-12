# Chatbot inicial con Anthropic

Actualizado: 2026-10-12. Implementación solicitada después del plan inicial.

## Comportamiento

Las cuatro tarjetas son ayudas de prompt opcionales. Se puede seleccionar una,
cambiar a otra o repetir clic para volver a General specialist. La selección
orienta la siguiente respuesta y se mantiene hasta cambiarla; no envía mensajes
automáticamente ni reemplaza la pregunta escrita.

El backend construye un único bloque `system`: instrucciones generales del
especialista + instrucciones del foco actual. El mensaje del usuario viaja separado.
El primer mensaje sin selección recibe el perfil general. Como Messages API es
stateless, se reenvían las instrucciones una sola vez por llamada junto al historial,
sin duplicarlas dentro de los mensajes visibles. Ver
[Messages API de Anthropic](https://platform.claude.com/docs/en/api/typescript/messages/create).

Los cinco perfiles están en `backend/src/application/services/chat/prompts.ts`.
La respuesta sigue el idioma del usuario; las etiquetas conservan el inglés de Physoft.

## Ejecutar

Usar Node 22.12+ o Node 24 para las herramientas frontend y pruebas.

1. En `backend/.env`, configurar `ANTHROPIC_API_KEY` y un modelo disponible en la cuenta:

   ```dotenv
   ANTHROPIC_API_KEY=<clave-del-servidor>
   ANTHROPIC_MODEL=claude-sonnet-5
   # Opcional: escoger otro modelo solo para chat
   CHAT_ANTHROPIC_MODEL=claude-sonnet-5
   ```

   Prioridad: `CHAT_ANTHROPIC_MODEL` → `ANTHROPIC_MODEL` → default existente
   `claude-sonnet-5`. El ID de ejemplo debe estar habilitado en la cuenta; no se
   comprobó disponibilidad con una clave real. La clave no va en variables VITE.

2. Configurar PostgreSQL, `JWT_SECRET` y credenciales de administrador como requiere
   el backend existente. Iniciar sesión desde `/login`: el chat exige Bearer JWT
   incluso mientras la autenticación global del resto de módulos está pausada.
3. Ejecutar `npm ci` y `npm run dev` en backend y frontend, en terminales separadas.
4. Abrir `/assistant`. Para usar una API remota, el frontend utiliza `VITE_API_URL`
   (incluyendo `/api`) como los otros servicios.

No se modificaron `.env` reales, pacientes, credenciales ni base de datos.

## Diseño técnico

- `POST /api/chat/messages`: `{ message, mode?, history? }`.
- Respuesta: `{ success: true, data: { content, mode, truncated } }`.
- El servidor valida longitud, roles alternados y campos permitidos; el cliente
  no puede elegir system prompt, proveedor, modelo, herramientas o IDs de pacientes.
- `ChatService` compone instrucciones; `AnthropicChatProvider` encapsula el SDK;
  controlador/ruta gestionan HTTP. Los análisis anteriores no cambian.
- Frontend: `useAssistantChat`, `assistantApi`, tipos y renderer `ChatMessage`
  separados de la página. Markdown sin HTML crudo ni imágenes remotas.
- Conversación solo en memoria de esta vista. Navegar fuera, recargar o cambiar
  identidad la elimina; no se guarda en localStorage ni PostgreSQL.
- Ventana de hasta 10 intercambios completos y 28.000 caracteres de historial.
  La pregunta tiene hasta 4.000 caracteres. Conversaciones largas pueden perder
  contexto antiguo aunque los mensajes permanezcan visibles en esta sesión.
- Respuestas completas (JSON), no streaming token a token. Indicador mientras se
  genera, botón Stop, error recuperable, retry del mismo turno y edición de pregunta.
- 2.048 tokens máximos de salida; aviso si se alcanza el límite. Timeout proveedor
  45 s, cliente 55 s, sin reintentos automáticos. Cancelar aborta el transporte y el
  trabajo upstream cuando se detecta la desconexión.
- 10 solicitudes/minuto por usuario con almacén en memoria por proceso. No es un
  límite distribuido ni un presupuesto global; establecer límites de gasto en
  Anthropic y store compartido antes de desplegar varias instancias.
- Se usan solo mensajes escritos, sin consultar expedientes, adjuntos o datos de
  ejemplo. El historial reenviado por el cliente no es una fuente clínica confiable.

El JWT usa el middleware existente (firma y caducidad); revocación inmediata y
validación de usuario activo contra DB quedan para el trabajo de autenticación.
No hay deduplicación de llamadas entre dispositivos ni persistencia de generación;
el frontend evita dobles clics y no duplica el turno visible al reintentar.

## Pruebas

Backend: `npm run test:chat` compila y ejecuta pruebas Node de prompts, validación,
contrato Anthropic simulado, errores, autenticación HTTP, límites y cancelación.

Frontend: `npm run test:chat` ejecuta pruebas de interacción/hook y render seguro.
`npm run lint:chat` comprueba solo el módulo. El script global `npm run lint`
ya carecía de configuración y sigue pendiente de normalización del repositorio.

Navegador: `npm run test:chat:e2e` usa Playwright en desktop y móvil, API interceptada
y una identidad sintética que nunca se envía a un backend real. Para instalar el
navegador de CI: `npx playwright install chromium`. En Windows con Edge instalado:

```powershell
$env:PLAYWRIGHT_CHANNEL='msedge'
npm run test:chat:e2e
```

Las capturas se guardan en `frontend/test-results` (ignorado por Git). Las pruebas
no envían solicitudes pagadas ni necesitan claves reales. En esta entrega no pudo
validarse inferencia real porque falta `ANTHROPIC_API_KEY` en el entorno local.

Verificación de esta entrega: 8 pruebas backend, 12 frontend y 2 de navegador
(desktop y móvil) aprobadas; builds backend/frontend y `lint:chat` aprobados.
El build sigue avisando del tamaño del bundle principal preexistente. El asistente
y su renderer Markdown se cargan de forma diferida desde la ruta `/assistant`.

Se incorporaron React Markdown/GFM, Testing Library, Vitest y Playwright. Vite se
actualizó de 5 a 6 para usar una versión corregida y compatible de Vitest 4.
La auditoría final no señaló vulnerabilidades en las dependencias directas nuevas
del chat/pruebas consultadas; el repositorio todavía tiene alertas en otras
dependencias. No se aplicó una actualización masiva ni `npm audit fix --force`.

## Alcance posterior

Persistencia, streaming, fuentes verificadas, selección de evaluaciones y cuotas
distribuidas siguen pendientes. No se desplegó ni se empaquetó la aplicación.
Antes de distribuir Electron, corregir la inclusión preexistente de `backend/.env`
y los patrones amplios de `extraResources`; las claves compartidas deben permanecer
en servidor remoto. La autenticación global y los mocks de informes siguen siendo
trabajo separado identificado en el plan inicial.
