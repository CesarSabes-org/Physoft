# Estado del proyecto

Actualizado: 2026-10-13 · rama `main`

## Funcionalidades en producción

### Acceso y sesión
- Login con JWT (rol `ADMIN`), con botón para mostrar u ocultar la contraseña.
- La sesión persiste en el navegador hasta que el token expira (`JWT_EXPIRES_IN`, 7 días por defecto) o se cierra sesión.
- Logout rápido en el header del Home y en Settings → Session. Cambio de contraseña en Settings.
- Rutas protegidas en el frontend y en el backend (`/api/athletes`, `/api/analyses` y `/api/claude` requieren token).

### Pacientes
- Alta, edición, detalle y listado con búsqueda; foto en Cloudinary.
- Modal de consentimiento informado antes de registrar al paciente.

### Evaluaciones (New / Edit Assessment)
- **Flexibilidad (casilla 1):** 4 pruebas estandarizadas. Puntos: Poor 25 · Average 60 · Excellent 100 · Risk 100 con advertencia aparte. Flexibility Score = promedio de las 4.
- **Measured Results (casillas 2–9):** Explosive/CMJ, Fatigue, Balance, Gait, Mobility ROM, Muscle Asymmetry (EMG), Fall Risk e InBody.
- Selector de deporte de la evaluación (define la ilustración del reporte) y lado dominante declarado.
- **Autocompletado con IA** (`POST /api/claude/extract-clinical-results`): solo transcribe valores impresos en los PDF o imágenes adjuntos, nunca inventa. El evaluador los verifica.
- Los resultados se guardan en `Analysis.clinicalResults` (JSONB) y se validan en `backend/src/domain/types/clinicalResults.ts`.

### Reporte de evaluación
- Sigue el PDF del cliente "Physoft fuentes y criterios de calificación".
- Clasificaciones con reglas reproducibles en `frontend/src/utils/clinicalScoring.ts`; sin datos simulados.
- Estructura del reporte esperado por los fisioterapeutas (la misma en pantalla y en el PDF):
  1. **Paciente y evaluación:** datos registrados en la evaluación, fecha y hora, deporte evaluado, casillas evaluadas y fuentes.
  2. **Executive Summary:** cobertura (casillas evaluadas / 9, en lugar de un puntaje global), áreas a trabajar (hallazgos) y fortalezas (las mismas reglas, leídas al revés).
  3. **Capacity Profile — 7 tarjetas:** Mobility/Flexibility, Explosive Output, Fatigue/Resistance, Stability & Balance, Fall Risk, Muscular Symmetry (EMG), Body Composition. Solo Flexibility muestra un puntaje sobre 100, sin categoría (el cliente no definió cortes).
  4. **Key Graphs & Analysis — 9 tarjetas:** 1 Flexibilidad, 2 CMJ, 3 Fatiga, 4 Estabilidad (balance + fall risk + marcha), 5 EMG, 6 mapa de compensaciones, 7 ROM (con % de la referencia), 8 InBody, 9 Inertial Force del deporte.
  5. **Detailed Analysis:** limitaciones, tensión/acortamiento, recomendaciones del profesional y Progress Over Time (solo con visitas comparables, al menos 7 días de diferencia).
- **Exportación a PDF:** `/analysis-view/:id/report` muestra el documento A4 con la marca Physoft. **Download PDF** lo genera y lo descarga directamente (mismo resultado desde cualquier dispositivo); **Print** abre el diálogo de impresión.

### Asistente clínico (chatbot)
- Conversaciones persistentes por usuario con Anthropic y cuatro focos opcionales.
- Detalle en [CHATBOT_SETUP.md](CHATBOT_SETUP.md).

### Otros
- Dashboard con métricas, actividad reciente y tendencia de evaluaciones.
- Analytics, Reports y Protocols aparecen como "Coming Soon".

## Decisiones clínicas (no cambiar sin el cliente)

- **Sin "Textual Analysis" (retirado el 2026-10-20 a pedido del fisioterapeuta):** era redundante con las casillas medidas (Biobit/asimetría = EMG de la casilla 7; inertial force sigue "Not evaluated"). Se quitaron la sección de New/Edit Assessment, el anexo del reporte/PDF y `POST /api/claude/analyze-assessment`. Los textos ya guardados (`aiAnalysisResults` y los 6 campos de texto libre antiguos) siguen en la base, pero no se muestran.

- Un valor ausente se muestra como **"Not evaluated"**, nunca como 0.
- No hay puntaje global ni comparación de cohorte hasta que exista una fórmula justificada.
- Inertial Force se muestra como "Not evaluated" hasta tener adquisición y un método de cálculo validado.
- Asimetría muscular: solo predominancia aparente (amplitud EMG), sin calificar Good/Poor.
- Fall Risk se copia de la clasificación del dispositivo; se refiere a caídas, no a riesgo de lesión general.

## Valores pendientes del cliente

No inventarlos; mientras falten, el reporte muestra "Pending reference" o usa el valor provisional indicado.

- [ ] Percentiles P25/P75 de balance.
- [ ] Referencias de ROM del tronco.
- [ ] Umbral de "claramente limitado" en movilidad (provisional: 80 %).
- [ ] Límites de ROM excesivo.
- [ ] Rango de grasa corporal para mujeres (provisional: 18–28 %).
- [ ] Fórmula del puntaje global.
- [ ] Método de cálculo de Inertial Force.

## Bugs conocidos

- [x] All Assessments empareja mal pacientes y evaluaciones (`Number(uuid)`). *Corregido 2026-10-14.*
- [x] El store de Zustand muestra datos desactualizados o sobrescritos en Dashboard y AthleteDetail. *Corregido 2026-10-14: las páginas siempre refrescan al entrar y AthleteDetail ya no sobrescribe la lista global.*
- [x] Edit Assessment pierde la hora y puede correr la fecha un día. *Corregido 2026-10-14: fecha y hora en hora local, mismo control que New Assessment.*
- [x] Los formularios de edición no permiten vaciar campos. *Corregido 2026-10-14 (evaluación y paciente).*
- [x] La vista del reporte en pantalla muestra el somatotipo en español ("Mesomorfo"); el PDF lo muestra en inglés. *Corregido 2026-10-14: una sola función para pantalla y PDF.*
- [x] En Assessments, la tarjeta "This Week" muestra el total de evaluaciones, no las de la semana (`Analysis.tsx`). *Corregido 2026-10-14: últimos 7 días, igual que el Dashboard.*
- [ ] Al guardar Edit Assessment se pierde `evidencePublicId` de las fotos de flexibilidad (el frontend no lo envía). La foto se sigue viendo, pero al borrar la evaluación esa imagen queda huérfana en Cloudinary.

## Riesgos y deuda técnica

- **Límite de subida de Vercel (~4.5 MB):** PDFs grandes pueden fallar en el autocompletado con IA.
- **Lint general del frontend sin configuración:** solo el módulo del chatbot tiene `lint:chat`; `npm run lint` no funciona hasta definir un `.eslintrc`.
- **Fotos locales heredadas en `backend/public/uploads/athletes/`** (37 archivos versionados en el repo público, servidos en `/uploads`). Todas las subidas nuevas van a Cloudinary. Antes de borrarlas, confirmar en la base que ningún paciente tenga una foto con ruta `/uploads/...`.
- **`backend/src/presentation/controllers/chatController.ts`** no lo usan la app ni las pruebas (lo reemplazó `conversationController`). Pendiente de que Daniel confirme y lo retire.
