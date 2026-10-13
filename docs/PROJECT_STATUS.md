# Estado del proyecto

Actualizado: 2026-10-13 · rama `physoft_web`

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
- **Análisis de texto con IA** por casilla (`POST /api/claude/analyze-assessment`), editable y guardado aparte de los resultados medidos.
- Los resultados se guardan en `Analysis.clinicalResults` (JSONB) y se validan en `backend/src/domain/types/clinicalResults.ts`.

### Reporte de evaluación
- Sigue el PDF del cliente "Physoft fuentes y criterios de calificación".
- Clasificaciones con reglas reproducibles en `frontend/src/utils/clinicalScoring.ts`; sin datos simulados.
- Secciones: Executive Summary, Results Overview, Results in Detail (casillas 1–9), Movement Compensation Map, Progress Over Time (solo visitas comparables, con al menos 7 días de diferencia), Sport Report y Detailed Analysis.
- **Exportación a PDF:** `/analysis-view/:id/report` muestra el documento A4 con la marca Physoft. **Download PDF** lo genera y lo descarga directamente; **Print** abre el diálogo de impresión.

### Asistente clínico (chatbot)
- Conversaciones persistentes por usuario con Anthropic y cuatro focos opcionales.
- Detalle en [CHATBOT_SETUP.md](CHATBOT_SETUP.md).

### Otros
- Dashboard con métricas, actividad reciente y tendencia de evaluaciones.
- Analytics, Reports y Protocols aparecen como "Coming Soon".

## Decisiones clínicas (no cambiar sin el cliente)

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

- [ ] All Assessments empareja mal pacientes y evaluaciones (`Number(uuid)`).
- [ ] El store de Zustand muestra datos desactualizados o sobrescritos en Dashboard y AthleteDetail.
- [ ] Edit Assessment pierde la hora y puede correr la fecha un día.
- [ ] Los formularios de edición no permiten vaciar campos.
- [ ] La vista del reporte en pantalla muestra el somatotipo en español ("Mesomorfo"); el PDF lo muestra en inglés.

## Riesgos y deuda técnica

- **Límite de subida de Vercel (~4.5 MB):** PDFs grandes pueden fallar en el autocompletado con IA.
- **Restos de la versión de escritorio en `frontend/`:** `electron.cjs`, `preload.cjs`, `electron/` y las dependencias `electron` y `better-sqlite3`. Pendientes de revisar y limpiar.
- **Lint general del frontend sin configuración:** solo el módulo del chatbot tiene `lint:chat`.
