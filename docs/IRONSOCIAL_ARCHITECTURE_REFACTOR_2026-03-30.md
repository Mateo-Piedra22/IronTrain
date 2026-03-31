# IronSocial Architecture Refactor (2026-03-30)

## 1. Executive Summary

Este refactor reposiciona IronSocial desde una experiencia tipo tablero mixto hacia una arquitectura social feed-first, desacoplada por dominios, con sincronización near real-time y observabilidad operativa.

La implementación persiguió dos objetivos simultáneos:

1) Mejorar UX social sin perder compatibilidad funcional.
2) Elevar robustez técnica para operación continua (reconexión, fallback, salud del canal realtime, trazabilidad de eventos).

Resultado: se consolidó una base social moderna en app y website, manteniendo comportamiento legacy donde corresponde, y agregando resiliencia enterprise para entornos con red inestable, estados de app variables y cargas reales.

---

## 2. Strategic Intent (Qué se buscó lograr)

### 2.1 Objetivo de producto

- Priorizar consumo de actividad social real (feed) sobre navegación administrativa.
- Separar semánticamente feed, notificaciones y solicitudes para reducir fricción cognitiva.
- Aumentar percepción de “sistema vivo” con actualización continua y feedback visual de estado.

### 2.2 Objetivo técnico

- Eliminar acoplamiento estructural entre dominios de inbox.
- Definir contratos explícitos por dominio entre app y API.
- Evitar recargas globales innecesarias con sincronización selectiva.
- Introducir canal realtime con degradación controlada (SSE -> polling) sin regressions.

### 2.3 Objetivo operativo

- Instrumentar señales de salud realtime (errores, stale, recoveries, transporte activo).
- Habilitar alertado y seguimiento en PostHog para operación proactiva.

---

## 3. Scope

### 3.1 En alcance

- Arquitectura social en app (tabs, feed, inbox clásico, leaderboard).
- API website de social (`inbox`, `pulse`, `stream`).
- Store social con motor de sincronización y resiliencia.
- Contratos de datos para sync por dominio.
- Observabilidad PostHog (mobile + server-side).

### 3.2 Fuera de alcance

- Reescritura completa del modelo de dominio social.
- Cambio de proveedor de analytics.
- Rediseño completo de website social público.

---

## 4. Baseline Issues (Problemas previos)

- Inbox mezclaba `activity_log`, `direct_share` y requests sin frontera de dominio.
- Refresh de datos con tendencia a recarga amplia, incluso ante cambios parciales.
- Ausencia de canal realtime estructurado y de degradación segura.
- Baja observabilidad de salud operacional (difícil detectar stale, caída de stream, degradación).

---

## 5. Architecture Decisions

### 5.1 Feed-first con convivencia legacy

Se adoptó feed moderno como experiencia principal, manteniendo bandeja clásica como modo alternativo para compatibilidad y transición gradual.

### 5.2 Contratos por dominio

Se establecieron versiones por dominio (`profile`, `feed`, `notifications`, `friends`, `leaderboard`) para sincronizar solo lo necesario.

### 5.3 Realtime híbrido y robusto

Canal primario: SSE.

Canal de fallback: polling.

Comportamiento: degradación automática ante falla de stream y reintento de upgrade posterior a SSE.

### 5.4 Observabilidad operativa

Se instrumentaron eventos móviles y backend para visibilidad de transporte, degradación, recuperación, errores y lifecycle de conexiones stream.

---

## 6. Implemented Changes by Layer

## 6.1 Domain selectors (desacople semántico)

Archivo: `src/social/socialSelectors.ts`

Funciones clave:

- `selectActivityFeed(...)`
- `selectNotificationShares(...)`
- `selectIncomingFriendRequests(...)`
- `buildStories(...)`
- `buildActivityVisualSummary(...)`

Beneficio: dominio social normalizado y reutilizable en UI/analytics sin lógica duplicada por pantalla.

## 6.2 App UX: feed-first + notificaciones separadas

Archivo: `app/(tabs)/social.tsx`

Cambios:

- Header orientado a consumo social (search, notifications, profile).
- Feed moderno como modo principal.
- Bandeja clásica conservada como modo alternativo.
- Integración de estado realtime en superficies sociales.

Archivo: `components/social/SocialNotificationsModal.tsx`

- Notificaciones desacopladas de feed.
- Gestión explícita de requests/rutinas compartidas.
- Archivado masivo con consistencia de seen-state.

Archivo: `components/social/SocialFeedTab.tsx`

- Render visual de post social.
- Doble tap para kudos.
- Historias y resumen de rendimiento.
- Indicador LIVE en cabecera del feed.

## 6.3 API Contract: inbox por scope

Cliente:

- Archivo: `src/services/SocialService.ts`
- Método: `getInbox(scope)`

Servidor:

- Archivo: `website/app/api/social/inbox/route.ts`
- Scopes:
  - `all`
  - `feed`
  - `notifications`

Beneficio: payloads coherentes por caso de uso y menor acoplamiento query/UI.

## 6.4 Pulse por dominio + selective sync

Archivos:

- `website/src/lib/social-pulse.ts`
- `website/app/api/social/pulse/route.ts`
- `src/store/useSocialStore.ts`

Cambios:

- Consolidación del cálculo de pulse en helper compartido server.
- `domainVersions` por dominio para invalidación selectiva.
- Refresh parcial de store según dominio afectado.
- Merge robusto de inbox con clasificación por dominio (`activity_log`, `direct_share`, `other`).

## 6.5 Realtime SSE + fallback polling

Servidor:

- Archivo: `website/app/api/social/stream/route.ts`
- Eventos SSE: `ready`, `pulse`, `heartbeat`.
- Emisión de pulse solo ante cambio de versión.
- Heartbeat para mantener liveness.
- TTL de conexión y cierre controlado.

Store app:

- Archivo: `src/store/useSocialStore.ts`
- Primario SSE, fallback automático a polling.
- Reintento de upgrade de polling a SSE.
- Health watchdog para stale detection.
- Ajuste de cadencia por AppState y conectividad (NetInfo).
- Cleanup completo de timers/subscriptions/controladores.

UI:

- Archivos:
  - `components/social/SocialFeedTab.tsx`
  - `components/social/InboxTab.tsx`
  - `components/social/LeaderboardTab.tsx`
- Estado visible: `LIVE · SSE` o `LIVE · POLLING`.

## 6.6 Rate limiting y protección de canal

Archivo: `website/src/lib/rate-limit.ts`

Cambios:

- Límite dedicado para pulse.
- Límite dedicado para stream (`SOCIAL_STREAM`).

Objetivo: controlar presión por reconexiones y mantener estabilidad de backend.

## 6.7 Observabilidad PostHog

Mobile (store):

- `social_realtime_started`
- `social_realtime_transport_changed`
- `social_realtime_stale_detected`
- `social_realtime_recovered`
- `social_realtime_stream_error`
- `social_realtime_sync_error`
- `social_realtime_stopped`

Server stream:

- `social_stream_connected`
- `social_stream_closed`

Helpers/documentación:

- `website/src/lib/posthog-server.ts`
- `website/app/admin/components/PostHogGuidePanel.tsx`

---

## 7. Data Contracts (Referencia)

## 7.1 Social Pulse payload

Campos principales:

- `version`
- `profileUpdatedAtMs`
- `latestActivityAtMs`
- `latestShareAtMs`
- `latestFriendAtMs`
- `latestScoreAtMs`
- `latestFriendProfileAtMs`
- `latestLeaderboardAtMs`
- `pendingShareCount`
- `pendingFriendRequestCount`
- `domainVersions`
- `serverTimeMs`

Semántica:

- `version`: firma global de sincronización.
- `domainVersions`: firma por dominio para refresh selectivo.

## 7.2 Stream event model

- `ready`: handshake inicial.
- `pulse`: estado nuevo con versión distinta.
- `heartbeat`: liveness sin cambio de versión.

---

## 8. Reliability and Compatibility Guarantees

- No se removió la ruta funcional legacy crítica (bandeja clásica sigue disponible).
- Ante falla de stream, el sistema no se detiene: degrada a polling.
- Se priorizó compatibilidad de comportamiento por encima de optimización agresiva.
- Las mejoras de realtime son aditivas, no disruptivas.

---

## 9. Validation and Quality Evidence

Validación técnica ejecutada:

- Revisiones de errores sin hallazgos en archivos modificados.
- Builds de website exitosas tras cambios de API/stream/observabilidad.
- Verificación de presencia de rutas API sociales en salida de build.

Testing funcional existente:

- `src/social/__tests__/socialSelectors.test.ts`
- Cobertura base de separación de dominios y utilidades de feed.

---

## 10. Operational Runbook (Resumen)

Si SSE falla:

1) App marca degradación.
2) Cambia a `POLLING` automáticamente.
3) Mantiene sincronización funcional.
4) Reintenta upgrade a SSE en ventana programada.

Señales a monitorear en PostHog:

- Incremento en `social_realtime_transport_changed` hacia `polling`.
- Suba de `social_realtime_stale_detected`.
- Diferencia anómala entre `social_stream_connected` y `social_stream_closed`.

---

## 11. Business and Product Impact

- Mejor tiempo de reacción percibida en superficie social.
- Menor carga cognitiva por separación feed/notificaciones.
- Mayor resiliencia en red real (móvil) sin pérdida de continuidad.
- Base lista para escalar engagement social medible.

---

## 12. Risks, Trade-offs, and Mitigations

Riesgos:

- Mayor complejidad operativa del canal realtime.
- Riesgo de sobreinstrumentación si no se controla volumen de eventos.

Mitigaciones:

- Throttling en captura de métricas realtime.
- Rate limits dedicados por endpoint.
- Watchdog y cleanup estricto de recursos.

---

## 13. Next Enterprise Steps

1) Consolidar dashboard canónico de salud realtime con ownership explícito (Engineering + Product).
2) Definir SLOs de canal social (stale ratio, recovery time, fallback ratio).
3) Incorporar tests de integración para escenarios de degradación/recovery.
4) Alinear website social público con la taxonomía de eventos y contratos de selectors.
5) Extender score de engagement con señales sociales (kudos emitidos/recibidos, guardados, respuestas).

---

## 14. Conclusión

La refactorización no fue solo de interfaz: se estableció una arquitectura social operable a escala, con dominio desacoplado, sincronización selectiva, canal realtime resiliente y visibilidad operativa. Esto reduce deuda técnica, mejora experiencia diaria y habilita evolución segura del producto social en próximas iteraciones.

---

## 15. Prompt Hardening Inputs (para auditoría V10)

Este informe origina requisitos obligatorios para el prompt maestro de auditoría:

1) **Cierre con evidencia verificable**
- Cada claim de mejora debe mapear a archivos modificados, tests y señales operativas.

2) **Runbook testeable, no solo documental**
- Deben existir tests de integración para:
  - degradación SSE -> polling
  - recovery polling -> SSE
  - detección de stale por watchdog/heartbeat

3) **SLOs explícitos de realtime**
- Definir y monitorear:
  - `fallback_ratio`
  - `recovery_time_p95`
  - `stale_detection_rate`

4) **Observabilidad con presupuesto de eventos**
- Mantener throttling para evitar sobreinstrumentación.
- Alertar desviaciones entre `social_stream_connected` y `social_stream_closed`.

5) **Ownership operativo**
- Dashboard canónico de salud realtime con ownership conjunto Engineering + Product.

Resultado esperado: el prompt V10 obliga verificación objetiva de claims y evita falsos “done” en refactors sociales y cross-domain.
