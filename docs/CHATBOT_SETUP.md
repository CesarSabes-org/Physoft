# Chatbot con Anthropic: funcionamiento y operación

Actualizado: 2026-10-12.

## Comportamiento

Las cuatro tarjetas son selecciones opcionales. Un clic marca una especialidad;
otro clic permite cambiarla o desmarcarla. Seleccionar no crea conversaciones,
no muestra carga y no llama a la IA. La primera pregunta se envía con Send o Enter
(Shift + Enter agrega una línea). Al enviar, el foco queda fijo y las tarjetas
desaparecen. New conversation permite elegir nuevamente. Sin selección se usa
General specialist.

El servidor envía en cada petición a Anthropic un bloque system con las instrucciones
generales y el foco guardado. La segunda pregunta mantiene ese perfil y el contexto
reciente. No se concatena texto oculto al mensaje visible del usuario. El cliente
no controla el system prompt ni el historial enviado al modelo.

Las conversaciones y turnos se guardan en PostgreSQL por usuario. La lista permite
reabrirlos y eliminarlos; el parámetro ?chat=ID conserva el chat activo al recargar.
Los UUID de solicitud permiten reintentar sin duplicar un turno completado. Un
bloqueo por conversación impide generaciones concurrentes. Los intentos interrumpidos
expiran a los 65 segundos; un trabajador anterior no puede sobrescribir su reintento.

## Configuración y arranque

Usar Node 22.12+ o Node 24. Configurar exclusivamente en backend/.env:

```dotenv
DATABASE_URL=<postgresql>
JWT_SECRET=<secreto-aleatorio-estable>
ADMIN_EMAIL=<correo-administrador>
ADMIN_PASSWORD=<contraseña>
ANTHROPIC_API_KEY=<clave-anthropic>
CHAT_ANTHROPIC_MODEL=<modelo-habilitado-en-la-cuenta>
```

No guardar claves en VITE_* ni versionar .env. El adaptador usa CHAT_ANTHROPIC_MODEL,
después ANTHROPIC_MODEL y finalmente su valor predeterminado. Configurar explícitamente
un modelo disponible en la cuenta antes de probar inferencia real.

Desde la raíz, npm run dev:web (o run-dev.bat / run-dev.sh) inicia ambos servidores.
El predev del backend ejecuta seed:admin: crea el administrador si falta y conserva
su contraseña si ya existe. Un restablecimiento intencional se hace desde backend
con npm run seed:admin -- --reset-password. El seed de acceso no crea pacientes ni
borra datos. La autenticación protege las rutas del chat y los datos del backend.

## Base de datos y corrección del almacenamiento

Tablas: chat_conversations y chat_turns. Migración:
backend/prisma/migrations/20261012090000_add_persistent_chats/migration.sql.

El 2026-10-12 se verificó primero en PostgreSQL local aislado y después se aplicó
solo esta migración aditiva a la base configurada de producción, dentro de una
transacción con lock_timeout de 5 segundos. Se registró con prisma migrate resolve
--applied 20261012090000_add_persistent_chats. Se verificaron las tablas, el login
administrador y la lectura del historial. No se modificaron atletas ni evaluaciones.

**Sigue pendiente una migración ajena al chat:**
20260714120000_add_ai_analysis_results_and_convert_units. Incluye una conversión
de medidas de atletas. No ejecutar db:deploy indiscriminadamente en esa base:
revisar por separado la correspondencia entre esquema, unidades y registro de
migraciones. Esta entrega no ejecutó ni marcó como aplicada esa migración.

En una base nueva, revisada para ese destino, npm run db:deploy aplica las migraciones.
No ejecutar prisma migrate dev ni reset contra producción.

## API y límites

- GET /api/chat/conversations: lista propia.
- POST /api/chat/conversations: { id, mode? }, creación idempotente.
- GET /api/chat/conversations/:id: mensajes propios ordenados.
- DELETE /api/chat/conversations/:id: elimina conversación y turnos propios.
- POST /api/chat/conversations/:id/messages: { requestId, message }.

Se verifica el JWT y la propiedad en servidor. Los DTO no exponen tokens de trabajo,
leases ni ownerId. Máximo 4.000 caracteres por pregunta; contexto de hasta 10
intercambios completos y 28.000 caracteres. El historial completo queda guardado,
aunque las partes antiguas puedan quedar fuera del contexto enviado al modelo.

La salida es JSON completo, sin streaming; máximo 4.096 tokens de respuesta,
timeout del proveedor 45 segundos, del cliente 55. Markdown sin HTML ejecutable
ni imágenes remotas. No se consultan expedientes ni se ejecutan herramientas.
El límite de 10 solicitudes de creación/envío por minuto y usuario vive por proceso;
para varias instancias hará falta un almacén compartido.

## Verificación reproducible

Backend: npm run test:chat. Las pruebas de persistencia exigen TEST_DATABASE_URL
con host localhost/127.0.0.1 y base llamada physoft_chat_tests, previamente migrada.
Si falta esa variable, la integración se omite explícitamente; nunca usa .env
para elegir una base de pruebas. Se comprobó con PostgreSQL local en el puerto 55439.

Frontend: npm run test:chat, npm run lint:chat, npm run build.
Navegador: npm run test:chat:e2e; en Windows puede usarse PLAYWRIGHT_CHANNEL=msedge.
Las pruebas de navegador interceptan la API y usan identidad sintética.

Resultado de esta corrección: 6 pruebas backend (incluyendo integración PostgreSQL),
7 frontend y 2 de navegador (escritorio/móvil) aprobadas. Builds aprobados; persiste
el aviso previo de tamaño del bundle principal. Las capturas están en test-results,
ignorado por Git. No se probó inferencia real: ANTHROPIC_API_KEY no está configurada
en el entorno local. No se desplegó el código a un hosting.

## Siguientes mejoras

Streaming, fuentes verificadas, selección autorizada de evaluaciones, cuotas
distribuidas y paginación del historial. Antes de empaquetar Electron, corregir
la inclusión heredada de backend/.env en extraResources: las claves compartidas
deben permanecer en un servidor remoto.

## Ajuste de idioma y longitud

El idioma se decide en cada turno según la pregunta actual o el idioma solicitado
explícitamente. Una respuesta anterior en español no debe arrastrar una pregunta
en inglés al español. Se priorizan respuestas completas y concisas (normalmente
150–400 palabras), con un presupuesto de salida de 4.096 tokens. El aviso de
truncamiento se conserva si el proveedor realmente alcanza ese límite; aumentar
el presupuesto no garantiza respuestas de longitud ilimitada. Se retiró la etiqueta
Powered by Claude de la interfaz.
