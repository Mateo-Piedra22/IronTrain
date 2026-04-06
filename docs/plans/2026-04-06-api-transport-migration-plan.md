# API Transport Migration Plan (Polling vs SSE/Webhooks/WebSocket)

## Tracker de ejecución (operativo)

Estado global:

- [x] P0 completado
- [x] P1 completado
- [x] P2 completado
- [x] P3 completado / cerrado por condición

### P0 — Admin realtime por SSE

- [x] P0.1 Crear `GET /api/admin/sync-health/stream` (SSE + heartbeat + auth/rate limit)
- [x] P0.2 Crear `GET /api/admin/themes/stream` (SSE + heartbeat + auth/rate limit)
- [x] P0.3 Migrar `SyncHealthPanel` a `EventSource` con fallback polling
- [x] P0.4 Migrar `ThemesModerationPanel` a `EventSource` con fallback polling
- [x] P0.5 Validar errores de tipos/lint de archivos tocados

### P1 — Optimización de costo stream social

- [x] P1.1 Agregar memoización temporal de `computeSocialPulse` por usuario
- [x] P1.2 Integrar cache en `social/stream` para reducir recomputación por conexión
- [x] P1.3 Mantener semántica de eventos (`pulse`, `heartbeat`, `ready`)
- [x] P1.4 Validar errores de tipos/lint de archivos tocados

### P2 — Trigger remoto para sync móvil (`sync_hint`)

- [x] P2.1 Definir soporte de `sync_hint` en recepción de notificación móvil
- [x] P2.2 Conectar `sync_hint` con `syncScheduler.syncNow()` con guardrails
- [x] P2.3 Añadir endpoint admin interno para enviar `sync_hint` (MVP controlado)
- [x] P2.4 Validar errores de tipos/lint de archivos tocados

### P3 — Evaluación WebSocket colaboración

- [x] P3.1 Cerrar como “No ejecutar” (sin requisito de colaboración bidireccional)

Decisión de cierre P3:

- Estado: **No ejecutar** en este ciclo.
- Motivo: no existe requisito vigente de colaboración bidireccional en tiempo real (presencia/locks/edición concurrente), por lo que WebSocket global no aporta ROI frente a la arquitectura actual (SSE + fallback polling + webhooks).

## Estado actual confirmado (app + website)

- La app móvil ya opera un modelo **híbrido realtime** para social: `SSE` primario + `polling` fallback en [src/store/useSocialStore.ts](src/store/useSocialStore.ts#L344-L607).
- El backend expone stream social en [website/app/api/social/stream/route.ts](website/app/api/social/stream/route.ts#L11-L184), con eventos `ready`, `pulse`, `heartbeat`.
- El sync core móvil ya es **event-driven + periodic safety check** mediante scheduler en [src/services/SyncSchedulerService.ts](src/services/SyncSchedulerService.ts#L58-L103).
- Ya existe webhook de GitHub para sync de changelog en [website/app/api/webhooks/github/route.ts](website/app/api/webhooks/github/route.ts#L1-L60).
- Existen paneles admin con polling fijo (`sync health`, `themes moderation`) en [website/src/components/admin/SyncHealthPanel.tsx](website/src/components/admin/SyncHealthPanel.tsx#L76-L83) y [website/app/admin/components/ThemesModerationPanel.tsx](website/app/admin/components/ThemesModerationPanel.tsx#L75-L84).

---

## Principios de decisión de transporte

1. **Webhook**: para eventos externos sistema-a-sistema (GitHub, Stripe, etc.).
2. **SSE**: para actualizaciones servidor→cliente near-real-time, unidireccionales, con bajo overhead operacional.
3. **WebSocket**: solo cuando exista colaboración bidireccional en vivo (presencia, locks, typing, conflicto en tiempo real).
4. **Polling**: conservar para:
   - watchdog de seguridad,
   - tareas de baja frecuencia,
   - modos background/offline,
   - fallback de resiliencia.
5. **No reemplazar por reemplazar**: mantener polling donde el costo de migrar supera valor real para UX/SLO.

---

## Matriz ejecutable por flujo (qué se espera que ocurra y cómo debe funcionar)

## 1) Social realtime (feed/inbox/friends/leaderboard/themes)

### Comportamiento esperado
- Cambios sociales deben reflejarse casi en vivo cuando la app está activa.
- Si el stream falla, el usuario no debe perder actualización funcional.
- Al volver online o foreground, se debe forzar re-sync.

### Transporte objetivo
- **Mantener** `SSE` primario + `polling` fallback (ya implementado).
- **No migrar a WebSocket** en esta fase.

### Función operativa requerida
- `realtimeSource` visible (`sse`/`polling`) y reconexión automática.
- Health check stale para autocorrección.
- Upgrade automático de `polling -> SSE` tras ventana de reintento.

### Acciones técnicas
- Endurecer servidor de stream para multi-conexión (ver Fase P1).
- Mantener `pulse` por dominio para invalidación selectiva.

### Criterios de aceptación
- Caída de stream no bloquea UX social.
- Recovered sync < 60s tras reconexión de red.
- Métricas realtime sin gaps de observabilidad.

---

## 2) Admin live monitoring (Sync Health + Themes Moderation)

### Comportamiento esperado
- Tablero admin debe reflejar estado sin refrescar manualmente.
- Frecuencia de actualización alta en horario operativo.
- Sin tormenta de requests cuando hay múltiples admins.

### Transporte objetivo
- **Migrar** de polling fijo a `SSE` con fallback polling manual/temporizado.

### Función operativa requerida
- Conexión viva con heartbeat.
- Reconnect con backoff.
- Botón de refresh inmediato para auditoría manual.

### Acciones técnicas
- Crear endpoints:
  - `GET /api/admin/sync-health/stream`
  - `GET /api/admin/themes/stream`
- Cliente admin: `EventSource` + fallback a polling cada 20-30s si no hay stream.

### Criterios de aceptación
- Reducción > 60% de requests periódicos en panel admin.
- Latencia de actualización visible < 5s desde evento servidor.

---

## 3) Sync core móvil (push/pull/snapshot/wipe)

### Comportamiento esperado
- Integridad primero: sin pérdida, sin reorder inválido, sin corrupción por concurrencia.
- Sync debe ejecutarse por eventos de negocio y también por safety schedule.

### Transporte objetivo
- **Mantener HTTP request/response + scheduler con polling periódico**.
- No migrar a SSE/WS para transferencia de lotes de datos del core sync.

### Función operativa requerida
- Trigger por cola (`SYNC_QUEUE_ENQUEUED`), resume, reconexión, manual.
- Polling periódico como red de seguridad (`periodic`).
- Backoff ante fallas transitorias.

### Acciones técnicas
- Mantener scheduler actual.
- Añadir trigger remoto opcional por push notification de tipo `sync_hint` (Fase P2).

### Criterios de aceptación
- Sin degradar tasa de sync exitoso.
- Sin incremento de conflictos de integridad.

---

## 4) Update check de app (releases)

### Comportamiento esperado
- Verificar nuevas versiones en background de forma económica.
- Revalidar al volver a foreground.

### Transporte objetivo
- **Mantener polling** (cada 1h + resume-trigger) en [src/services/UpdateService.ts](src/services/UpdateService.ts#L26-L74).

### Razón
- Caso de negocio de baja frecuencia; SSE/WS no aporta ROI real.

### Criterios de aceptación
- Sin aumento de consumo de red/batería.
- Detección de update mantenida.

---

## 5) Integraciones externas (webhooks)

### Comportamiento esperado
- Eventos externos deben disparar sincronización interna confiable.
- Firma validada, idempotencia y filtering por evento.

### Transporte objetivo
- **Mantener/fortalecer webhook** de GitHub en [website/app/api/webhooks/github/route.ts](website/app/api/webhooks/github/route.ts#L1-L60).

### Acciones técnicas
- Filtrar eventos de interés (`release.published`, cambios en changelog si aplica).
- Agregar deduplicación por `delivery id` en tabla de auditoría webhook.
- Añadir retries seguros con lock/idempotency key.

### Criterios de aceptación
- Cero sync duplicados por redelivery.
- Cero ejecución si firma inválida.

---

## 6) Share público (routine/theme)

### Comportamiento esperado
- Payload público debe responder rápido y estable.
- No requiere “realtime push” al consumidor.

### Transporte objetivo
- **Mantener pull HTTP on-demand** en:
  - [website/app/api/share/routine/[id]/route.ts](website/app/api/share/routine/[id]/route.ts#L1-L176)
  - [website/app/api/share/theme/[slug]/route.ts](website/app/api/share/theme/[slug]/route.ts#L1-L83)

### Criterios de aceptación
- Latencia estable.
- Rate limiting funcional para tráfico anónimo.

---

## Resultado de clasificación final

## Migrar a SSE
- Admin Sync Health.
- Admin Themes Moderation.

## Mantener SSE + polling fallback (sin migrar a WS)
- Dominio social móvil/web (feed/inbox/friends/leaderboard/themes invalidation).

## Mantener polling
- Update checks.
- Scheduler de seguridad de sync.
- Timers UI/locales y watchdogs internos.

## Mantener / fortalecer webhooks
- GitHub -> changelog sync (con idempotencia y filtering fino).

## No recomendado en esta fase
- WebSocket global del producto (sin caso fuerte de colaboración bidireccional).

---

## Plan de implementación por fases (ejecutable)

## Fase P0 (rápida, 3-4 días) — Admin realtime por SSE

### Alcance
- SSE para `sync-health` y `themes moderation`.
- Fallback polling degradado.

### Entregables
- Nuevas rutas stream admin.
- Refactor componentes admin para `EventSource`.
- Métricas de transporte (`sse_connected`, `fallback_polling`, `stream_error`).

### PRs sugeridos
1. `feat(admin): add sync-health sse stream`
2. `feat(admin): add themes moderation sse stream`
3. `refactor(admin-ui): eventsource transport with polling fallback`

### Exit criteria
- Paneles funcionando sin refresh manual continuo.
- Fallback validado al cortar stream.

---

## Fase P1 (1 sprint) — Optimización de costo del stream social

### Problema actual
- El stream computa pulse en loop por conexión, elevando costo bajo fan-out.

### Alcance
- Introducir agregador/cache compartida por usuario por ventana corta (ej. 1-2s).
- Separar heartbeat de recomputación pesada.

### Entregables
- `social-pulse` con memoización temporal y dedupe por user.
- Contadores operativos (`compute_hits`, `cache_hits`, `stream_clients`).

### Exit criteria
- Reducción medible de carga DB/CPU en picos.
- Sin pérdida de frescura visible en UI.

---

## Fase P2 (1 sprint) — Trigger remoto para sync móvil (sin eliminar periodic)

### Alcance
- Push notification silenciosa/data-message: `sync_hint`.
- App al recibir `sync_hint` dispara `syncScheduler.syncNow()` con guardrails.

### Entregables
- Nuevo tipo de evento en backend notifications.
- Handler en app con rate limit local.

### Exit criteria
- Menor tiempo de convergencia de datos entre dispositivos.
- Sin loops de sync.

---

## Fase P3 (condicional) — Evaluación WebSocket para colaboración en vivo

### Trigger de negocio necesario
- Edición simultánea de rutina compartida, presencia de usuarios, locks y resolución en vivo.

### Si no existe ese requisito
- **No ejecutar P3**.

---

## Contratos de eventos propuestos (P0/P1)

## Admin `sync-health` stream events
- `ready`: estado inicial.
- `health.delta`: cambio en señales/operaciones.
- `heartbeat`: liveness.

## Admin `themes` stream events
- `ready`: estado inicial de colas.
- `theme.queue.changed`: variación de pending/reports.
- `theme.status.changed`: approve/reject/suspend/restore.
- `heartbeat`.

Formato recomendado:
```json
{ "event": "theme.status.changed", "ts": 1770000000000, "payload": { "themePackId": "...", "status": "approved" } }
```

---

## Observabilidad y SLOs (obligatorio)

## KPIs técnicos
- Ratio de fallback a polling (admin/social).
- Tiempo de recuperación p95 tras caída de stream.
- Diferencia entre `stream_connected` y `stream_closed`.
- Requests/min por panel admin antes/después P0.

## SLO inicial recomendado
- `fallback_ratio < 0.15`
- `recovery_p95 < 60s`
- `admin_update_latency_p95 < 5s`

---

## Riesgos y mitigaciones

1. **SSE en infra serverless puede cortar conexiones largas**  
   Mitigar: TTL de stream + reconnect cliente + heartbeat + fallback polling.

2. **Eventos duplicados por reconexión**  
   Mitigar: idempotencia por `eventId`/`ts` en cliente.

3. **Webhook redelivery duplicando sync**  
   Mitigar: tabla de dedupe por delivery id + lock por ventana corta.

4. **Sobrecosto de stream social por recomputación pulse**  
   Mitigar: cache temporal + fan-out inteligente (P1).

---

## Validación QA por fase

## P0
- Test de reconexión forzada admin.
- Test de fallback polling cuando stream responde 500/timeout.
- Test de autorización admin en stream endpoints.

## P1
- Load test simple con múltiples conexiones stream.
- Verificación de no regresión en frescura de feed.

## P2
- Test E2E de `sync_hint` en foreground/background.
- Verificar que no se dispara sync en loop.

---

## Definición de Done (DoD)

- Endpoint(s) con rate limit, auth, logging estructurado y métricas.
- Cliente con fallback resiliente y cleanup correcto.
- Dashboards con métricas de transporte y alertas mínimas.
- Documentación técnica actualizada y runbook de incidentes.

---

## Orden recomendado de ejecución (resumen)

1. **P0**: Admin SSE + fallback (alto impacto, bajo riesgo).  
2. **P1**: Optimización costo stream social.  
3. **P2**: Trigger remoto de sync móvil.  
4. **P3**: Solo si aparece necesidad real de colaboración bidireccional.

---

## Archivo base del análisis

Este plan se fundamenta en implementación actual de:
- social realtime app/store,
- stream/pulse backend,
- scheduler de sync,
- webhook GitHub,
- polling admin actual.

Se prioriza evolución incremental sin romper arquitectura local-first ni resiliencia offline.