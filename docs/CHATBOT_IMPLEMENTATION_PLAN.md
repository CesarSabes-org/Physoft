# Physoft: plan de implementación del chatbot

> Actualización 2026-10-12: el usuario eligió Anthropic y una primera entrega de
> conversación con cuatro focos opcionales, sin integración de expedientes.
> El estado y las instrucciones actuales están en [CHATBOT_SETUP.md](CHATBOT_SETUP.md).
> La arquitectura OpenAI/Gemini, persistencia y streaming descritos más abajo son
> la propuesta original, no funcionalidades implementadas ni requisitos de esta entrega.

## Entrega inicial solicitada el 2026-10-12

- [x] Cuatro tarjetas seleccionables, una a la vez y deselección al repetir clic.
- [x] Prompt base profesional y prompt específico de foco en el servidor.
- [x] Modo general si no se selecciona una tarjeta.
- [x] Anthropic Messages API con contexto acotado entre turnos.
- [x] UI responsive, Markdown seguro, detener/reintentar/editar y nueva conversación.
- [x] Ruta propia autenticada, validación y límites de tamaño/frecuencia/tiempo.
- [x] Pruebas automatizadas de backend, frontend y navegador con datos sintéticos.
- [ ] Inferencia real: `ANTHROPIC_API_KEY` no está configurada en este entorno.
- [ ] Persistencia, streaming y selección de evaluaciones: fuera de esta entrega.

Fecha: 2026-10-11. Estado: propuesta técnica; feature sin implementar.
Autor: Codex. Alcance de esta entrega: inspección de código y documentación,
plan de ejecución e instrucciones persistentes en `AGENTS.md`.

## 1. Recomendación

Construir un asistente contextual dentro de `/assistant`, conectado a evaluaciones
reales a través del backend. Una conversación podrá ser general o estar asociada
a un paciente y una evaluación. Empezar con texto, historial persistido, selección
explícita de contexto, respuestas progresivas y cuatro modos de ayuda.

Usar OpenAI como candidato principal para el flujo contextual sujeto a validación
de condiciones y controles de datos; habilitar Gemini para educación general
permitida y sin contexto clínico. Tener dos claves no implica que ambos proveedores
sean intercambiables para todos los usos. No llamar a ambos en cada mensaje.

La primera versión no necesita fine-tuning, LangChain, agentes autónomos, embeddings
ni una base vectorial. Los datos estructurados de Prisma y un pequeño catálogo de
contenido revisado son suficientes para empezar.

Supuestos: usuarios profesionales adultos, una única instalación/organización en
el piloto y base PostgreSQL como fuente autorizada. No se presupone acceso directo
de pacientes, múltiples clínicas, disponibilidad de modelos ni plan de pago.

## 2. Hallazgos del repositorio

Rutas relativas a la raíz del proyecto; comprobadas mediante lectura del código.

| Área | Evidencia | Implicación |
|---|---|---|
| Pantalla inicial | `frontend/src/pages/Assistant/Assistant.tsx` ya contiene los cuatro usos, input deshabilitado y Coming soon; ruta en `App.tsx` | Reemplazar el estado vacío conservando diseño y navegación |
| Frontend | React 18, Vite, TypeScript, Router 6, Zustand, Axios | Reutilizar stack; no introducir otro framework de UI |
| API | `frontend/src/services/api.ts`: `VITE_API_URL`, Axios, Bearer JWT, timeout de 30 s e interceptor 401 | Para streaming usar transporte dedicado que reproduzca autenticación y cierre de sesión |
| Backend | Express 4, TypeScript, carpetas por capas; `backend/prisma/schema.prisma` declara PostgreSQL | Añadir módulo de chat siguiendo estructura existente |
| Datos disponibles | `Athlete`, `Analysis`, capacidades 0–100, textos, `weakPoints`, `bodyMarks`, `aiAnalysisResults`, `flexibilityAssessment` | Se puede interpretar información guardada sin reenviar todos los archivos |
| IA Gemini/OpenAI | `backend/src/application/services/ai.service.ts` ofrece `generateText(prompt, imageBuffers)`; usa SDK antiguo de Google y Chat Completions | Es un generador de análisis de imágenes, no una conversación; reutilizar patrón, no prompt ni parser |
| Otra integración | `claudeAnalysisService.ts`, `/api/claude/analyze-assessment` y `claudeAPI` dependen de Anthropic | Las dos claves del usuario no sustituyen esa tercera dependencia; conservarla aislada y proponer migración posterior |
| Panel existente | `MiniChatPanel.tsx` presenta/edita un resultado de análisis | No es una conversación de varios turnos; extraer solo elementos visuales útiles |
| Autenticación | `backend/src/index.ts` monta atletas, análisis y Claude sin `authenticate`; `ProtectedRoute.tsx` devuelve `Outlet` sin validar sesión | Requisito previo a publicar chat y expedientes |
| Autorización | Solo existe rol `ADMIN`; `Athlete` y `Analysis` no tienen relación con usuario/organización | No afirmar aislamiento entre clínicas; MVP de una organización o incorporar tenancy antes de abrirlo a varias |
| Informes | `AnalysisView.tsx` carga un registro real pero varias tarjetas de `analysisReport` importan mocks | El chatbot no debe interpretar esas tarjetas como mediciones reales |
| Otros mocks | `useAIAnalysis.ts` simula resultados; no se confirmó que esté en el flujo activo | Auditar sus consumidores antes de eliminar o reutilizar |
| Consentimiento | `useConsentGate.ts` abre un modal y navega al aceptar; el esquema no guarda aceptación | No acredita autorización persistida para enviar datos a IA |
| Distribución desktop | `package.json` incluye `backend/.env` y `extraResources` con `**/*`; `electron/main.js` lo carga | Corregir ambos patrones; claves comerciales deben permanecer en backend remoto |
| Despliegue | `backend/vercel.json` usa `@vercel/node`; existen Electron raíz y `frontend/electron.cjs` | Verificar streaming y límites reales de la infraestructura; definir cuál empaquetado se soporta |
| Calidad | No hay script `test` en los tres package.json revisados; README describe rutas/SQLite que no corresponden al backend actual | Crear base de pruebas y actualizar documentación de ejecución |

La inspección no ejecutó la aplicación, no consultó pacientes, no leyó claves ni
realizó llamadas de inferencia. No equivale a una auditoría completa del software.

## 3. Los cuatro usos y su comportamiento

| Modo | Entrada y contexto | Respuesta esperada | Criterio de aceptación |
|---|---|---|---|
| `interpret_results` | Evaluación seleccionada, fecha, valores, unidades y procedencia | Datos observados → significado orientativo → limitaciones → preguntas útiles | Cita evaluación/campos usados, respeta valores ausentes y no transforma scores en diagnósticos |
| `explain_concepts` | Pregunta, nivel de detalle y lenguaje; sin paciente por defecto | Definición, ejemplo deportivo, aplicación y límites | Explica conceptos sin inventar artículos ni asumir lesiones |
| `protocol_guidance` | Objetivo, deporte, restricciones, equipo y contexto aportado por profesional | Borrador con objetivos, fases, frecuencia propuesta, criterios de progresión y revisión | Pregunta por información decisiva faltante; ningún protocolo se asigna o aprueba automáticamente |
| `performance_advice` | Objetivo, nivel, deporte, disponibilidad y limitaciones conocidas | Recomendaciones generales priorizadas y cómo observar su evolución | No promete resultados ni inventa cargas individualizadas sin datos |

Ejemplos: «Explica los scores de esta evaluación», «¿Qué diferencia hay entre
potencia y fuerza?», «Ayúdame a estructurar un borrador de entrenamiento con estas
restricciones» y «¿Qué hábitos generales ayudan a mejorar la recuperación?».

Los cuatro modos son plantillas del mismo servicio, no cuatro chatbots ni cuatro
llamadas simultáneas. La rehabilitación individual se limita a apoyo profesional
revisable; sin contexto suficiente, responder con preguntas y orientación general.
El nombre actual “Clinical Assistant” debe revisarse frente al alcance real del
producto: su documento de consentimiento describe servicios de fitness y rendimiento.

## 4. Proveedores y restricciones comprobadas

### OpenAI

Para el módulo nuevo, usar el SDK `openai` y Responses API, que permite streaming
por eventos. Mantener el historial en Physoft y enviar una ventana acotada de mensajes.
Configurar `store: false`; eso no elimina por sí solo los registros de control de
abuso ni acredita cumplimiento sanitario. [Streaming](https://developers.openai.com/api/docs/guides/streaming-responses)
y [controles de datos](https://developers.openai.com/api/docs/guides/your-data).

### Gemini

Usar `@google/genai` para el adaptador nuevo, de acuerdo con la
[guía de migración](https://ai.google.dev/gemini-api/docs/migrate). El código anterior
puede seguir temporalmente con su SDK hasta una migración con pruebas propias.
La generación y streaming se documentan en
[Text generation](https://ai.google.dev/gemini-api/docs/text-generation).

Los [términos consultados](https://ai.google.dev/gemini-api/terms) restringen el uso
en práctica clínica y asesoramiento médico; también excluyen información sensible
de los servicios gratuitos. Una cuenta de pago no elimina la restricción clínica.
Por ello, el plan no propone Gemini para interpretar expedientes clínicos ni para
rehabilitación individual. No inferir que los términos de Vertex AI sean iguales.

### Política de selección propuesta

| Contexto | Proveedor elegible |
|---|---|
| Explicaciones educativas generales sin datos personales ni asesoramiento médico | OpenAI o Gemini, según configuración y evaluación |
| Contexto de paciente, interpretación individual o rehabilitación | Solo proveedor aprobado para ese uso; candidato OpenAI con condiciones verificadas |
| Mensaje general que pasa a contener datos personales o consulta médica | Bloquear envío a Gemini y solicitar iniciar conversación contextual aprobada; no transferir historial silenciosamente |
| Error técnico de OpenAI en conversación clínica | Mostrar reintento; no redirigir a Gemini |

La política se aplica en servidor sobre todo el contexto/historial, no solo sobre
el modo elegido en la UI. La minimización y detección de información sensible son
capas adicionales, no una garantía de anonimización. Mantener Gemini apagado en
el piloto hasta verificar términos, plan de cuenta y filtros de entrada.

Seleccionar IDs de modelo mediante variables y una lista permitida del servidor.
Los defaults encontrados (`gpt-4.1-mini`, `gemini-2.5-flash`) describen el código,
no una recomendación de disponibilidad o calidad actual. Elegir tras una evaluación
comparativa con casos sintéticos. No se estiman precios sin modelo y tarifa confirmados.

## 5. Arquitectura propuesta

```text
Assistant / acceso desde AnalysisView o AthleteDetail
  -> useAssistantChat + assistantApi
  -> Express /api/chat + authenticate + autorización + cuota
  -> ChatService
       -> ChatRepository (Prisma)
       -> AssessmentContextService (datos reales, mínimos, versionados)
       -> ProviderPolicy (uso y datos permitidos)
       -> prompts por modo + catálogo educativo revisado
       -> ChatProvider: OpenAI | Gemini
  <- eventos SSE normalizados o JSON final
```

El modelo no recibe acceso directo a SQL, claves, filesystem ni herramientas de
escritura. El servidor decide qué datos consulta; los permisos no dependen del prompt.
Las fórmulas, conversiones y comparaciones numéricas se calculan en TypeScript.

### Archivos a crear

```text
backend/src/domain/types/chat.ts
backend/src/domain/ports/ChatProvider.ts
backend/src/application/services/chat/ChatService.ts
backend/src/application/services/chat/AssessmentContextService.ts
backend/src/application/services/chat/ProviderPolicy.ts
backend/src/application/services/chat/prompts/{system,modes}.ts
backend/src/infrastructure/ai/{OpenAIChatProvider,GeminiChatProvider}.ts
backend/src/infrastructure/repositories/ChatRepository.ts
backend/src/presentation/controllers/chatController.ts
backend/src/presentation/routes/chatRoutes.ts
backend/src/middleware/chatRateLimiter.ts
frontend/src/types/chat.types.ts
frontend/src/services/assistantApi.ts
frontend/src/hooks/useAssistantChat.ts
frontend/src/components/assistant/{ChatMessage,ChatComposer,ChatHistory,ContextSelector,SourceCard}.tsx
```

Modificar `schema.prisma`, registro de rutas en `index.ts`, `Assistant.tsx` y CSS,
los accesos contextuales, ejemplos de variables y scripts de pruebas. Elegir un
validador de DTO (por ejemplo Zod) y renderer Markdown sin HTML crudo, solo si se usan.
No refactorizar todos los servicios existentes en esta entrega.

### Contrato del adaptador

```ts
type ProviderEvent =
  | { type: 'delta'; text: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'done'; finishReason: 'completed' | 'length' | 'blocked' }

interface ChatProvider {
  stream(input: ChatProviderInput, signal: AbortSignal): AsyncIterable<ProviderEvent>
}
```

`ChatProviderInput` contiene instrucciones construidas en servidor, mensajes
normalizados, contexto mínimo, modelo permitido y presupuesto de salida.
Los errores se convierten a códigos internos; no exponer respuestas crudas del SDK.

## 6. Contexto y calidad de datos

1. El cliente envía IDs seleccionados, nunca un expediente completo como autoridad.
2. Verificar identidad activa, alcance de acceso, existencia, `deletedAt` y relación
   entre evaluación y atleta. Una evaluación de otro atleta no puede adjuntarse.
3. Recuperar solo datos pertinentes: deporte, edad calculada cuando sea necesaria,
   evaluación/fecha, capacidades, textos seleccionados, limitaciones y pruebas.
4. Excluir nombre, contacto, código de acceso, fotografías y URLs de archivos por
   defecto. No pasar todos los campos de Prisma con un spread.
5. Diferenciar valores registrados, cálculos y textos de IA. Para datos históricos
   sin trazabilidad marcar origen desconocido, nunca revisión profesional asumida.
6. Mantener `null`, unidades y fecha. Score 70/100 no significa percentil 70 ni
   “70% de capacidad saludable”. No convertir LOW/MEDIUM/HIGH a grados de movilidad.
7. Guardar versión, `updatedAt`, campos utilizados y hash del contexto por mensaje;
   indicar que una evaluación cambió al volver a consultar la conversación.
8. No arrastrar el contexto de otro paciente: el paciente queda fijado a la conversación.
   Cambiarlo crea otra conversación. El análisis seleccionado se fija al crearla en MVP.

Las clasificaciones de `ComparisonService` son reglas internas por deporte y
somatotipo; no tratarlas como normas científicas. Las comparaciones longitudinales
requieren pruebas, unidades y métodos compatibles. Auditar el fallback de ausencia
de datos antes de mostrar promedios como mediciones.

## 7. Persistencia propuesta

Crear migración aditiva y revisable; las entidades siguientes aún no existen.

| Entidad | Campos principales y reglas |
|---|---|
| `ChatConversation` | UUID, `userId`, `athleteId?` String, `analysisId?` Int, `mode`, `language`, `title`, timestamps; propietario desde JWT; índice `(userId, updatedAt)` |
| `ChatMessage` | UUID, conversationId, secuencia, role, content, status, provider/model, promptVersion, contextVersion, sourceRefs JSON, timestamps; secuencia única por conversación |
| `ChatGeneration` | UUID, conversationId, userMessageId, assistantMessageId, clientRequestId, attempt, status, usage, latencia, errorCode, leaseExpiresAt; unicidad `(conversationId, clientRequestId)` |
| `AiDataConsent` | usuario, atleta cuando aplique, versión de texto, finalidad, proveedores permitidos, fecha y revocación; distinguir reconocimiento del operador de autorización del paciente |
| `ChatFeedback` | messageId, userId, valoración, motivo opcional; autorización por conversación |

Estados de mensaje: `pending`, `streaming`, `completed`, `interrupted`, `failed`,
`blocked`. No guardar texto incompleto como respuesta terminada. Roles aceptados
desde cliente: ninguno; el servidor crea mensajes `user` y `assistant`.

Para un piloto de una organización, los administradores acceden al mismo conjunto
de pacientes, pero cada conversación es privada a su propietario. No implica
aislamiento de pacientes por profesional. Si se necesita ese aislamiento, añadir
asignaciones o `Organization/Membership` y alcance en TODAS las consultas antes de abrirlo.

Definir retención configurable antes del lanzamiento, borrado físico de mensajes,
contextos y feedback a petición autorizada, y conservación mínima de métricas sin
texto. Al eliminar un paciente, purgar también chats asociados; `SET NULL` no elimina
la información personal del contenido. Documentar retención de backups y del proveedor.

## 8. API y streaming

| Endpoint propuesto | Función |
|---|---|
| `GET /api/chat/capabilities` | Feature habilitada y modos disponibles; sin secretos |
| `POST /api/chat/conversations` | Crear con `mode`, `language`, `athleteId?`, `analysisId?` |
| `GET /api/chat/conversations?cursor=...` | Historial paginado del usuario |
| `GET /api/chat/conversations/:id/messages?cursor=...` | Mensajes autorizados y ordenados |
| `POST /api/chat/conversations/:id/messages` | `{ content, clientRequestId }`; SSE o JSON según `Accept` |
| `GET /api/chat/generations/:id` | Recuperar estado tras desconexión sin generar de nuevo |
| `POST /api/chat/generations/:id/cancel` | Cancelar generación autorizada |
| `POST /api/chat/messages/:id/feedback` | Registrar evaluación del usuario |
| `DELETE /api/chat/conversations/:id` | Cancelar generación activa y borrar historial asociado |

Errores HTTP antes de iniciar stream: 400 validación, 401 sesión, 403 política/consentimiento,
404 recurso no visible, 409 generación activa/conflicto idempotente, 429 cuota,
503 proveedor no configurado/disponible. Tras enviar cabeceras, emitir evento `error`.

Usar `fetch` con POST, Bearer JWT, `ReadableStream` y `AbortController`;
`EventSource` nativo no cubre este POST autenticado. Compartir base URL y comportamiento
401 con el cliente actual. El parser debe soportar chunks parciales, UTF-8 dividido,
varios eventos por chunk y final de conexión sin `done`.

Eventos de Physoft: `meta` (IDs, proveedor, contexto), `delta` (texto), `sources`
(referencias validadas), `done` (estado y uso disponible), `error` (código/reintento).
No reenviar al navegador eventos internos de razonamiento del proveedor.

Crear mensaje y generación de forma atómica antes de llamar a IA. Un solo turno
activo por conversación, con bloqueo/lease en DB y recuperación por expiración;
no depender de mapas en memoria bajo serverless. La misma `clientRequestId` devuelve
el estado existente, no hace otra llamada; payload distinto con el mismo ID da 409.
Un reintento explícito después de un fallo crea otro intento vinculado al anterior.
No mantener una transacción SQL abierta durante la llamada al proveedor.

Cancelar al desconectar cuando el runtime lo soporte; abortar el upstream y guardar
estado incompleto. Recuperar leases abandonados después de cortes del proceso.
Persistir texto al finalizar y checkpoints acotados si se necesitan, no cada token.

Comprobar comportamiento en Vercel y desktop antes de prometer streaming. Si el
hosting lo impide, habilitar JSON final con límite de tiempo coherente o mover el
endpoint a un servicio Node persistente. No añadir WebSockets al MVP.

## 9. Experiencia de usuario

- Estado inicial con las cuatro tarjetas como acciones reales y ejemplos editables.
- Selector visible de “General” o paciente/evaluación y fecha; explicar qué datos se usan.
- Historial lateral, nueva conversación, eliminar, detener y reintentar sin duplicar.
- Mensajes con carga, respuesta progresiva, fuentes expandibles y aviso de interrupción.
- Entrada multilínea: Enter envía, Shift+Enter añade línea, manejo correcto de IME,
  navegación con teclado, foco y anuncios accesibles sin leer cada token.
- “Preguntar sobre esta evaluación” desde `AnalysisView` y `AthleteDetail`.
- Mostrar disponibilidad de red; sin conexión no simular respuestas ni encolar envíos
  sensibles automáticamente. Historial local persistente fuera del MVP.
- Mantener inglés en etiquetas actuales; la respuesta sigue idioma del usuario o
  preferencia explícita español/inglés. No heredar prompts que fuerzan solo inglés.

Las fuentes de evaluación enlazan a registros de Physoft autorizados. Las referencias
educativas solo se muestran si existen en el catálogo revisado; sin recuperación,
identificar la respuesta como orientación general y no inventar bibliografía.

## 10. Fiabilidad, seguridad y coste

Autenticación y autorización en cada lectura, envío, cancelación y borrado.
Resolver primero el acceso a pacientes de las rutas existentes; proteger solo el
chat dejaría los expedientes expuestos. Revalidar estado de usuario para chat;
el middleware JWT actual solo verifica firma y caducidad.

Cuotas iniciales propuestas, ajustables después del piloto: 4.000 caracteres por
mensaje, 1 generación concurrente por conversación, 10 solicitudes/minuto/usuario,
50/día/usuario, salida máxima de 1.500 tokens y deadline de 45 segundos compatible
con el hosting. Historial de hasta 12 turnos completos, subordinado a un presupuesto
total de entrada por modelo. Reservar cuota atómicamente; liberar/reconciliar al finalizar.

Medir tokens reales cuando estén disponibles, proveedor/modelo, latencia al primer
texto, latencia total, fallos, cancelaciones y coste estimado con tarifa versionada.
Cuotas compartidas en DB o store distribuido; el limitador en memoria de Claude no
es un presupuesto global de producción. Añadir tope de gasto del proveedor.

Máximo un reintento técnico acotado antes del primer delta para fallos transitorios;
evitar multiplicarlo con reintentos internos del SDK. Sin retry para 401, payload
inválido, cancelación o bloqueo de seguridad. Respuesta parcial exige reintento
visible. Fallback entre proveedores apagado en MVP.

Prompt base: dominio deportivo, límites explícitos, datos ausentes, procedencia,
no diagnóstico autónomo, no aprobación de retorno al deporte ni tratamiento automático.
Las notas pueden contener prompt injection: delimitar datos y aplicar permisos fuera
del modelo. Sanitizar Markdown/enlaces y excluir HTML crudo.

Ante preguntas clínicas sensibles, solicitar contexto y revisión profesional; definir
con un profesional los casos que deben interrumpir recomendaciones de ejercicio.
No confiar únicamente en mostrar un disclaimer. Si se requiere revisión completa
de salida antes de mostrarla, usar respuesta bufferizada para ese modo: no se puede
retirar de la vista un consejo que ya se transmitió por streaming.

## 11. Entregas y dependencias

Estimaciones orientativas para una persona familiarizada con el repositorio;
excluyen tiempos de revisión profesional, condiciones comerciales e infraestructura.

### Fase 0 — base confiable (2–4 días)

- [ ] Confirmar uso profesional, despliegue principal y alcance de acceso a pacientes.
- [ ] Restablecer autenticación front/back y verificar autorización de datos.
- [ ] Excluir `.env` y secretos de ambos patrones de empaquetado; elegir API remota
      para claves compartidas. Si ya se distribuyeron claves, rotarlas.
- [ ] Revisar bootstrap de admin/configuración y arranque sin claves opcionales.
- [ ] Distinguir mocks visuales de mediciones reales; ningún mock entra al contexto.
- [ ] Definir política de proveedor, consentimiento persistido y retención.
- [ ] Capturar estado inicial de build/lint y crear infraestructura de pruebas.

Salida: endpoints de datos protegidos y demo con datos sintéticos, sin secretos empaquetados.

### Fase 1 — conversación vertical (3–4 días)

- [ ] Migraciones de chat, repository, DTO, ownership e idempotencia.
- [ ] Adaptador OpenAI, límites, deadline, manejo de errores y métricas mínimas.
- [ ] Assistant funcional con concepto/rendimiento general, historial y cancelación.
- [ ] Implementar SSE y opción JSON; validar corte y recuperación de generación.

Salida: conversación persistida y autorizada de extremo a extremo.

### Fase 2 — cuatro usos con contexto (3–5 días)

- [ ] AssessmentContextService con lista de campos, versiones y procedencia.
- [ ] Selector y accesos desde evaluación; modos interpretación y protocolos.
- [ ] Catálogo educativo inicial revisado y referencias internas verificables.
- [ ] Consentimiento aplicado en backend y pruebas de cambio/borrado de paciente.
- [ ] Adaptador Gemini para ámbito educativo permitido; política sin fallback clínico.

Salida: los cuatro casos cumplen su aceptación con evaluaciones sintéticas y revisión profesional.

### Fase 3 — piloto (2–4 días)

- [ ] Evaluaciones comparativas, feedback y ajustes de prompts/modelos.
- [ ] Cuotas distribuidas, borrado/retención, logs mínimos y alarmas de coste.
- [ ] Pruebas de despliegue, accesibilidad, red lenta y autenticación expirada.
- [ ] Activación gradual por feature flag y rollback que deshabilite generación.

Total orientativo: 10–17 días de desarrollo para el piloto. Varios usuarios/clínicas,
offline completo, biblioteca documental grande o migración del módulo Anthropic
son ampliaciones de alcance. Cada fase debe cerrar con evidencia, no solo capturas.

## 12. Verificación y criterios de salida

Añadir Vitest para lógica/frontend, Supertest para HTTP y pruebas de integración
contra PostgreSQL de pruebas para restricciones/transacciones. E2E del flujo crítico
con Playwright si el entorno lo permite. Ninguna suite automatizada requiere claves reales.

| Área | Casos indispensables |
|---|---|
| Acceso | Sin token, token expirado, conversación ajena, generación ajena, atleta borrado, análisis que no pertenece al atleta |
| Contexto | Null frente a cero, unidades/fechas, texto IA frente a dato medido, historial de otro paciente, contexto actualizado, exclusión de mocks/PII |
| Providers | Conversión de roles, error 401/429/5xx, timeout, respuesta vacía, bloqueo, usage ausente, Gemini denegado para contexto clínico |
| Streaming | Chunks partidos, Unicode, desconexión, cancelación, fallo después de delta, sin done, proceso interrumpido |
| Persistencia | Doble clic, retry con mismo ID, IDs con diferente payload, turnos concurrentes, lease expirado, borrado durante generación |
| Seguridad | Injection en notas, intento de exfiltrar otro paciente, enlaces/HTML malicioso, cuota distribuida y ausencia de secretos en bundle |
| UX | Cuatro modos, selector, recarga del historial, teclado, idioma, offline y 401 durante stream |

Crear 40 casos sintéticos versionados: 10 por capacidad, mezclando completos,
incompletos y adversariales. Evaluar exactitud respecto de datos, utilidad, límites,
referencias y lenguaje. Comparar proveedores solo en casos elegibles para ambos.
Registrar modelo y promptVersion. No usar otro LLM como único evaluador.

Puerta de salida: 100% de pruebas críticas de acceso y política; cero datos
numéricos inventados en el conjunto de interpretación; cero bibliografía inventada;
al menos 90% de respuestas aceptables según rúbrica profesional acordada. Son objetivos
de aceptación, no resultados obtenidos. Medir p50/p95 y coste por turno antes de fijar SLA.

Ejecutar `npm run build` en backend y frontend y `npm run lint` en frontend;
documentar fallos previos aparte. Estos comandos aún no se ejecutaron en esta revisión
documental. Probar llamadas reales solo con fixtures sintéticos y entorno configurado.

## 13. Configuración propuesta

Nombres nuevos salvo claves existentes. Valores ilustrativos, no configuración creada.

```dotenv
CHAT_ENABLED=false
CHAT_PRIMARY_PROVIDER=openai
OPENAI_API_KEY=<solo-en-servidor>
CHAT_OPENAI_MODEL=<id-verificado-en-la-cuenta>
GEMINI_API_KEY=<solo-en-servidor>
CHAT_GEMINI_MODEL=<id-verificado-en-la-cuenta>
CHAT_GEMINI_ENABLED=false
CHAT_FALLBACK_ENABLED=false
CHAT_MAX_OUTPUT_TOKENS=1500
CHAT_TIMEOUT_MS=45000
CHAT_DAILY_REQUEST_LIMIT=50
CHAT_RETENTION_DAYS=<definir-antes-de-produccion>
```

Configurar de forma lazy: si falta una clave opcional, deshabilitar ese proveedor;
si falta el principal, `/capabilities` informa indisponibilidad y el resto del
producto sigue arrancando. No guardar claves en settings de React ni pedir pegarlas
en una conversación. El frontend mantiene `VITE_API_URL`, no credenciales de IA.

## 14. Mejoras recomendadas después del MVP

| Prioridad | Mejora | Valor y dependencia |
|---|---|---|
| P0 | Informes basados en datos reales y trazabilidad por métrica | Evita interpretar mocks; registrar instrumento, unidad, método y revisión profesional |
| P0 | Roles y organizaciones si habrá varias clínicas | Aislamiento en todas las entidades/rutas antes de ampliar el acceso |
| P1 | Comparación longitudinal explicada | “Qué cambió desde la última evaluación”; cálculos deterministas y pruebas comparables |
| P1 | Biblioteca de conceptos/protocolos con fuentes | Contenido revisado, versión y vigencia; retrieval por categorías primero, búsqueda vectorial si el volumen lo justifica |
| P1 | Protocolos editables y aprobables | Activar `/protocols` con borrador, revisión, asignación y seguimiento; chat solo propone |
| P1 | Informes exportables | Activar `/reports` con datos reales, resumen profesional y versión comprensible para atleta |
| P1 | Auditoría de IA y coste | Autoría, modelo, prompt, aprobación, presupuesto y feedback por respuesta |
| P2 | Seguimiento de carga, bienestar y adherencia | Necesita nuevas mediciones y metodología antes de recomendar cambios |
| P2 | Adjuntos PDF/imágenes | Consentimiento, límites, extracción verificada, procedencia y pruebas de injection; aprovechar flujos existentes tras desacoplar proveedor |
| P2 | Voz y dictado de notas | Ahorra tiempo; edición y confirmación del profesional antes de guardar |
| P2 | Portal del atleta | Roles propios, lenguaje accesible y solo información autorizada; revisar elegibilidad de edad/proveedores |

No priorizar predicción de lesiones, diagnóstico automático o aprobación autónoma
de retorno al deporte: requieren evidencia y validación que el modelo de datos actual
no ofrece. La diferenciación inicial más útil es explicar datos confiables y ayudar
al profesional a elaborar acciones revisables.

## 15. Cómo continuar con Codex

`AGENTS.md` es el archivo de instrucciones del repositorio que Codex puede cargar;
este plan contiene el backlog específico. [Documentación de AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Prompt sugerido para la siguiente sesión:

> Lee AGENTS.md y docs/CHATBOT_IMPLEMENTATION_PLAN.md. Implementa la Fase 0 y,
> cuando estén sus verificaciones, la Fase 1. Conserva los contratos de análisis
> existentes, usa fixtures sintéticos y actualiza las casillas con evidencia.
> No publiques ni ejecutes migraciones en producción. Informa qué está probado,
> qué queda pendiente y cualquier decisión de producto que bloquee trabajo concreto.

Decisiones que deben confirmarse al preparar el lanzamiento, sin impedir el
prototipo con fixtures: despliegue web/desktop prioritario, una o varias clínicas,
política de acceso a pacientes, condiciones de proveedores, modelos/coste objetivo,
consentimiento, plazo de retención y profesional que revisará contenido.
