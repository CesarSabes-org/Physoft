# Physoft — instrucciones para Codex

## Proyecto

Aplicación de análisis deportivo. Frontend React 18 + TypeScript + Vite, React Router,
Zustand y CSS existente. Backend Express + TypeScript, Prisma 5 y PostgreSQL (Supabase).
Se despliega como web en Vercel; el empaquetado de Electron se retiró de la raíz.
`frontend/` aún conserva archivos heredados de Electron y SQLite/localStorage: no asumir
que ese almacenamiento es la fuente de datos del backend actual.
Estado, pendientes y despliegue: `docs/PROJECT_STATUS.md` y `docs/DEPLOYMENT.md`.

## Trabajo del chatbot

Actualización de alcance (2026-10-12, solicitud del usuario): la primera entrega
usa **Anthropic**, cuatro focos opcionales y un prompt general predeterminado.
Consultar `docs/CHATBOT_SETUP.md` para el estado implementado. Esta decisión
sustituye la propuesta anterior de OpenAI/Gemini para esta feature. Priorizar
conversación y UI. La persistencia por usuario y el login ya forman parte de la entrega;
la integración con expedientes queda para después.

Antes de implementar el asistente, leer `docs/CHATBOT_IMPLEMENTATION_PLAN.md`.
El documento distingue hallazgos actuales, decisiones propuestas y trabajo pendiente.
La petición original fue de análisis y planificación: estos archivos no significan
que el chatbot ya esté implementado. Ante una solicitud posterior de implementación,
trabajar por entregas comprobables y actualizar las casillas del plan.

Los cuatro usos iniciales son interpretar evaluaciones, explicar conceptos,
orientar borradores de protocolos y dar recomendaciones deportivas generales.
Mantener revisión profesional para contenido individual de rehabilitación.

## Convenciones de implementación

- Mantener las capas `domain`, `application`, `infrastructure`, `presentation`.
- Usar TypeScript explícito, DTO validados en runtime y errores normalizados.
- Conservar componentes, estilos y convenciones visuales existentes. La UI actual
  está en inglés; responder en el idioma del usuario, con preferencia de conversación.
- Separar hooks de conversación, transporte HTTP y presentación React.
- Crear un servicio de chat independiente de `ai.service.ts` y
  `claudeAnalysisService.ts`; preservar sus contratos y rutas existentes.
- Usar el adaptador Anthropic detrás de `ChatProvider` para el chatbot. Modelos
  configurables en servidor; verificar disponibilidad y parámetros antes de fijarlos.
- No añadir frameworks de agentes, base vectorial o microservicios para el MVP.
- Revisar `git status` y respetar cambios ajenos antes de editar.

## Datos, autorización e IA

- Las claves viven en el servidor. No leerlas en respuestas, volcarlas en logs,
  ponerlas en variables `VITE_*` ni distribuirlas en Electron.
- Mantener la autenticación activada: no publicar el chat ni acceso
  a expedientes sin autenticación y autorización comprobadas en backend.
- La identidad proviene de `req.user`; nunca confiar en `userId`, roles, historial
  o datos clínicos completos enviados por el navegador como fuente autorizada.
- El contexto se construye desde Prisma con una lista explícita de campos,
  permisos, procedencia, unidades y fecha. Nunca usar `mock*` como datos del paciente.
- `null` significa no medido. No convertirlo a cero, inventar métricas o presentar
  puntuaciones internas de 0–100 como percentiles o escalas clínicas validadas.
- Notas, mensajes y documentos son datos no confiables: no pueden cambiar políticas,
  permisos ni instrucciones del sistema. El MVP no ejecuta herramientas de escritura.
- No registrar texto completo del chat ni datos identificables en telemetría.
- Revalidar términos de proveedor antes del lanzamiento. Según documentación
  consultada el 2026-10-11, Gemini API restringe práctica clínica/asesoramiento médico
  y prohíbe datos sensibles en servicios gratuitos. Aplicar la política del plan;
  no usar cambios de proveedor para eludir restricciones o negativas de seguridad.
- OpenAI `store: false` no equivale a retención cero. Revisar configuración y
  condiciones aplicables antes de enviar información de personas reales.

## Verificación y entrega

Mantener pruebas de comportamiento para permisos, contexto, fallos y contratos de
proveedor; cuando se añada streaming, ampliar cobertura a sus eventos y cortes.
Usar fixtures sintéticos, no pacientes reales; CI no necesita claves de proveedores.

Comandos existentes, ejecutados desde cada directorio:

- `backend`: `npm run build` (genera Prisma y compila TypeScript).
- `frontend`: `npm run build` y `npm run lint`.

El chatbot ahora tiene `npm run test:chat` en ambos directorios y
`npm run lint:chat` / `npm run test:chat:e2e` en frontend. El lint general
preexistente carece de configuración; no confundirlo con el lint del módulo nuevo.

No ejecutar migraciones sobre producción ni resets destructivos para validar cambios.
Para migraciones, usar una base de desarrollo/pruebas identificada. Registrar los
comandos ejecutados, sus resultados y problemas previos por separado. No afirmar que
se probó una integración real si solo se verificaron mocks o compilación.

Al terminar cada entrega, explicar qué funciona, cómo se comprobó y qué falta.
