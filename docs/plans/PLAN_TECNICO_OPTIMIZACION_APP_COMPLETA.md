# Plan Técnico Completo de Optimización — IronTrain App (Mobile)

## 1) Resumen Ejecutivo

Este plan define una estrategia **ejecutable**, por fases, para optimizar de forma robusta toda la app móvil de IronTrain en:

- consumo de batería,
- consumo de red/datos,
- rendimiento (CPU/JS/UI),
- eficiencia de almacenamiento local,
- velocidad visual y estabilidad operativa.

El plan está diseñado para ejecutarse sin cambiar la UX funcional base, priorizando mejoras internas de arquitectura, scheduling, renderizado, sincronización y observabilidad.

---

## 2) Objetivos

### 2.1 Objetivo principal

Reducir consumo total de recursos sin degradar experiencia de usuario ni consistencia de datos.

### 2.2 Objetivos medibles (SLO internos)

- **Batería:** reducir wakeups JS/background loops en **20–35%**.
- **Red:** reducir requests redundantes en **30–50%** (especialmente Social + Sync).
- **UI:** reducir frames >16ms en flujos críticos en **20–30%**.
- **DB local:** reducir lecturas full-scan/queries amplias en **25–40%**.
- **Arranque:** bajar trabajo no crítico en cold start y mejorar TTI percibido.

---

## 3) Alcance

## 3.1 Incluido

- Navegación global y ciclo de vida de app.
- Tabs principales: Diario, Biblioteca, Análisis, Social.
- Subpantallas y modales asociados.
- Servicios core: Sync, Social, Update, Notifications, Location, Analysis, Workout.
- Stores globales (Zustand) y hooks transversales.
- Persistencia local SQLite y patrones de invalidación/caché.

### 3.2 Excluido (esta versión)

- Cambios de producto/UX no solicitados.
- Refactorizaciones cosméticas sin impacto de consumo.
- Rediseño de backend completo (solo ajustes de cliente + contratos mínimos necesarios).

---

## 4) Estado actual observado (base técnica)

Se identifican focos de consumo por superposición de timers, listeners y refrescos simultáneos:

1. **Sync global** con múltiples disparadores y periodicidad fija.
2. **Realtime Social** con fallback polling y múltiples entradas de refresh.
3. **Timer de workout** sincronizado desde más de un loop.
4. **Refrescos de Diario** que recalculan más de lo necesario tras acciones pequeñas.
5. **Análisis** con cargas pesadas en paralelo por foco.
6. **Ubicación/clima** con política agresiva para contexto de uso.
7. **Toasts/notificaciones** con barridos y triggers frecuentes.

---

## 5) Principios de optimización

1. **Single source of truth por dominio** (timer, sync state, feed freshness).
2. **Coalescing y deduplicación** de eventos de refresh.
3. **Scheduling adaptativo por contexto** (foreground/background, online/offline, pantalla activa).
4. **Invalidación incremental**, no recálculo global por defecto.
5. **Caché con TTL + invalidación explícita por eventos semánticos**.
6. **Observabilidad primero**: no optimizar a ciegas.
7. **Feature flags y rollout gradual** para minimizar riesgo.

---

## 6) KPIs y Telemetría (baseline y seguimiento)

## 6.1 KPIs técnicos

- Requests/min por dominio (`sync`, `social`, `updates`, `notifications`).
- Wakeups/min (intervals, app state transitions activas).
- Tiempo de render por tab (focus → first interactive).
- DB query time p50/p95 y número de queries por interacción.
- Re-renders por componente crítico (Social feed, Diario list, Analysis cards).
- Errores de red/sync por hora y tasa de retry/backoff.

### 6.2 Métricas UX

- Tiempo percibido de cambio de tab.
- Tiempo de respuesta al marcar serie/completar acción.
- Tiempo de apertura de Social y Análisis.

### 6.3 Instrumentación mínima requerida

- Eventos analíticos para entrada/salida de loops.
- Contadores de dedupe (cuántos refreshes se evitaron).
- Marcadores de versión de optimización por build para comparar cohortes.

---

## 7) Arquitectura objetivo (alto nivel)

### 7.1 Orquestación de refresh unificada

Crear una capa de orquestación por dominio con:

- `request(reason)`
- `coalesce(windowMs)`
- `throttle(cooldownMs)`
- `cancelIfObsolete(requestId)`

Aplicar en Social, Sync y secciones de Diario con alta frecuencia de mutación.

### 7.2 Scheduler adaptativo

Timers y polling con estado-aware:

- Foreground + pantalla activa: frecuencia normal.
- Foreground + pantalla no activa: frecuencia reducida.
- Background: mínimo operativo o suspendido.
- Offline: pausa de ciclos y reintento inteligente al reconectar.

### 7.3 Política de invalidación incremental

Tras mutaciones locales:

- invalidar solo el subconjunto afectado,
- refrescar agregado global bajo demanda o diferido.

---

## 8) Plan por fases (ejecutable)

## Fase 0 — Observabilidad y Guardrails (Semana 1)

**Objetivo:** establecer baseline confiable y seguridad de despliegue.

**Estado:** 🟡 En validación de baseline (implementación completada).

### Tareas

- [x] Definir dashboard de KPIs técnicos y UX. (ver `docs/OPTIMIZATION_KPI_DASHBOARD.md`)
- [x] Instrumentar eventos en servicios críticos (Sync/Social/Timer/Update/DB).
- [x] Agregar feature flags de optimización por dominio:
   - `opt.sync.scheduler.v2`
   - `opt.social.realtime.v2`
   - `opt.timer.unified.v1`
   - `opt.diary.incremental_refresh.v1`
   - `opt.analysis.lazy_loading.v1`
- [x] Definir protocolo de rollback por flag. (ver sección 14 y `docs/OPTIMIZATION_KPI_DASHBOARD.md`)

### Criterio de salida

- [ ] Baseline de 3 días con datos consistentes. *(pendiente por ventana temporal de medición)*
- [x] Flags funcionales y auditables.

---

## Fase 1 — Alto impacto inmediato (Semanas 2–3)

**Objetivo:** reducir consumo principal de red/batería sin tocar UX visible.

**Estado:** 🟡 Implementación P0 completada, validación KPI en curso.

### Workstream 1: Sync Scheduler

- [x] Consolidar disparadores de sync y aplicar coalescing por razón.
- [x] Endurecer `minInterval` por contexto y anti-burst.
- [x] Pausar periodic sync si no hay cola pendiente ni staleness real.
- [x] Backoff exponencial con jitter y límite de intentos por ventana.

### Workstream 2: Realtime Social

- [x] Definir SSE-first estricto y polling solo fallback real.
- [x] Evitar refresh concurrente por focus + event bus + pull + pulse.
- [x] Deduplicar por dominio (`profile/feed/notifications/friends/leaderboard`).
- [x] En background, degradar frecuencia automáticamente.

### Workstream 3: Timer unificado

- [x] Eliminar duplicidad de loops de timer workout.
- [x] Mantener un único tick source en store.
- [x] Validar precisión en resume/background/foreground. *(tests: `src/store/__tests__/workoutStore.test.ts`)*

### P0 adicional

- [x] Eliminar barrido por intervalo de toasts.

### Criterio de salida

- [ ] Menos requests/h en Social+Sync.
- [ ] Menos wakeups/min medidos.
- [x] Sin regresión funcional en sync y timer.

---

## Fase 2 — Optimización de Diario + DB (Semanas 4–5)

**Objetivo:** disminuir I/O local y costo de refrescos por interacción.

**Estado:** 🟡 Implementación técnica en progreso.

### Workstream 4: Diario incremental

- [x] Separar refresh de sets del refresh global de calendario.
- [x] Actualización optimista local + confirmación diferida.
- [x] Invalidar solo fecha/sesión afectada.
- [x] Recalcular calendario global por lote o idle callback.

### Workstream 5: SQLite y consultas

- [x] Revisar queries pesadas de eventos/joins en flujo diario.
- [x] Introducir índices faltantes en campos de filtro/orden más usados.
- [ ] Medir p95 antes/después por query crítica.

### Criterio de salida

- [ ] Reducción de queries por acción de set.
- [ ] Menor latencia al editar/crear/borrar sets.

---

## Fase 3 — Análisis, ubicación y notificaciones (Semanas 6–7)

**Objetivo:** optimizar tareas costosas no críticas en tiempo real.

**Estado:** 🟡 Implementación completada; validación KPI en curso.

### Workstream 6: Analysis lazy + cache

- [x] Cargar data por subtab activa (no todo en paralelo siempre).
- [x] Aumentar TTL de caché donde sea seguro.
- [x] Preagregados diarios/semanales para métricas de dashboard.

### Workstream 7: Ubicación adaptativa

- [x] Cambiar estrategia default de precisión para social/weather.
- [x] Escalar precisión solo cuando sea estrictamente necesario.
- [x] Reducir frecuencia de refresh de ubicación fuera de interacción directa.

### Workstream 8: Notificaciones y toasts

- [x] Eliminar barridos periódicos innecesarios de toasts.
- [x] Consolidar eventos de notificación persistente para evitar spam de updates.
- [x] Revisar frecuencia de audio/hápticos de alta cadencia.

### Criterio de salida

- [ ] Menor costo en tab Análisis.
- [ ] Menor actividad en segundo plano por ubicación/notifications.

### Estado de fase

- [x] Fase 3 completada a nivel implementación de tareas.

---

## Fase 4 — Hardening, QA y rollout (Semana 8)

**Objetivo:** desplegar con riesgo controlado y evidencia.

**Estado:** 🟡 En progreso.

### Tareas

- [x] Test de regresión funcional del núcleo de stores (sync/social/timer/workout). *(última validación focalizada: `workoutStore`, `AnalysisService`, `FeedbackService` en verde)*
- [ ] Smoke tests por plataforma/dispositivo.
- [ ] Rollout gradual (10% → 30% → 60% → 100%).
- [ ] Monitoreo de KPIs + errores por cohorte.
- [ ] Si hay degradación, rollback por flag por dominio.

### Criterio de salida

- [ ] KPIs objetivo dentro de rango por 7 días.
- [ ] Sin aumento de crash rate.

---

## 9) Matriz de trabajo por sección de la app

## 9.1 App shell / Layout

- Diferir inicialización no crítica.
- Serializar arranque crítico (auth/db/config) y posponer extras.
- Evitar doble registro de listeners globales.

### 9.2 Tab Diario

- Actualización incremental de sets.
- Menos recálculo de calendario completo por microcambio.
- Reducir trabajo en `focus` si no hubo invalidaciones relevantes.

### 9.3 Tab Biblioteca

- Revisar carga de listas (FlashList sizing y stable keys).
- Evitar recargas de rutinas/categorías si no cambió fuente.

### 9.4 Tab Análisis

- Lazy por subtab.
- Preagregados + caché con TTL extendido.
- Evitar recomputar toda la serie ante cambios menores.

### 9.5 Tab Social

- Un solo canal de frescura de datos.
- Dedupe de refreshes y cancelación de requests obsoletos.
- Reducir frecuencia de ubicación/pulse en contexto no activo.

### 9.6 Subpantalla workout/[id]

- Único timer source.
- Persistencia con intervalo configurable y seguro.
- Evitar re-renders innecesarios por props no estables.

### 9.7 Modales (interval timer, history, notifications)

- Activar loops solo cuando el modal está visible y activo.
- Limpiar listeners/timers estrictamente al cerrar.

---

## 10) Backlog ejecutable (priorizado)

## P0 (crítico)

1. Unificar timer de workout (eliminar doble intervalo).
2. Coalescing en SyncScheduler + guardas anti-burst.
3. Dedupe de refresh en Social (focus/event/realtime/pull).
4. Eliminar barrido por intervalo de toasts.

### P1 (alto)

5. Invalidador incremental para Diario/calendario.
6. Política SSE-first robusta con fallback controlado.
7. Lazy-load por subtab en Análisis.

### P2 (medio)

8. Optimización de ubicación por precisión/frecuencia.
9. Ajuste fino de notificaciones persistentes y hápticos de alta frecuencia.
10. Mejoras de índice/queries SQLite según baseline.

---

## 11) Criterios de aceptación (Definition of Done)

Cada paquete se considera cerrado cuando cumple:

1. KPI técnico del paquete mejora vs baseline.
2. No hay regresión funcional en flows críticos.
3. Tests automáticos relevantes en verde.
4. Feature flag asociado habilitable/deshabilitable.
5. Evidencia before/after documentada.

---

## 12) Riesgos y mitigación

### Riesgo A: Frescura social percibida menor por menos polling
- Mitigación: SSE-first + heartbeat + fallback controlado + alertas de staleness.

### Riesgo B: Inconsistencias de timer tras unificación
- Mitigación: suite de pruebas foreground/background/resume.

### Riesgo C: Caches demasiado agresivas
- Mitigación: invalidación por eventos semánticos y TTL por dominio.

### Riesgo D: Cambios de sync afecten consistencia
- Mitigación: rollout gradual + métricas de conflictos/reintentos + rollback por flag.

---

## 13) Estrategia de pruebas

## 13.1 Pruebas técnicas

- Unit tests para dedupe/coalescing/scheduler.
- Integration tests para sync flows y social refresh.
- Pruebas de timer en transición de app state.
- Pruebas de consultas y caché en Analysis/Diary.

### 13.2 Pruebas de rendimiento

- Sesión estándar 30 min (log de wakeups, requests, frames).
- Escenario social activo (feed + notificaciones + realtime).
- Escenario de edición intensiva de sets.

### 13.3 Pruebas de estabilidad

- reconexiones de red,
- cambios foreground/background,
- timeouts backend,
- modo offline temporal.

---

## 14) Rollout operativo

1. Activar flags en 10% de usuarios internos/testers.
2. Monitorear 48h KPIs y errores.
3. Subir a 30% y repetir.
4. Subir a 60% y repetir.
5. 100% si se cumplen umbrales.

Rollback inmediato por dominio si:

- error rate > umbral acordado,
- caída de UX crítica,
- inconsistencias de sync/timer.

### 14.1 Runbook de rollback por feature flag

1. Identificar dominio afectado en dashboard KPI.
2. Desactivar solo el flag del dominio afectado:
   - `opt.sync.scheduler.v2`
   - `opt.social.realtime.v2`
   - `opt.timer.unified.v1`
   - `opt.diary.incremental_refresh.v1`
   - `opt.analysis.lazy_loading.v1`
3. Verificar recuperación en ventana de 15–30 minutos.
4. Mantener el resto de flags activos para evitar rollback global innecesario.
5. Adjuntar evidencia before/after y registrar incidente.

---

## 15) Entregables finales

1. Baseline técnico y reporte comparativo.
2. Implementación por fases con flags.
3. Informe before/after por KPI.
4. Checklist de operación y rollback.
5. Documento de lecciones aprendidas.

---

## 16) Checklist operativo (ejecución rápida)

- [ ] Baseline completo (3 días).
- [x] Flags por dominio activos.
- [ ] P0 implementado y validado.
- [ ] P1 implementado y validado.
- [ ] P2 implementado y validado.
- [ ] Rollout gradual completado.
- [ ] KPIs objetivo alcanzados.
- [ ] Cierre y documentación final.

---

## 17) Nota de ejecución

Este plan está preparado para ejecutarse en sprints técnicos de 1 semana con control por feature flags y evidencia cuantitativa por fase.
