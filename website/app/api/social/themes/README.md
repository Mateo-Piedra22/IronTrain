# Social Themes API — Blueprint v1

Esta carpeta documenta el contrato esperado para nuevas rutas del dominio de temas.

## Endpoints

### `GET /api/social/themes`

Query:

- `scope=public|owned|friends`
- `mode=light|dark|both`
- `sort=trending|new|top`
- `page`, `pageSize`, `q`

Respuesta:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

### `GET /api/social/themes/:id`

Devuelve detalle completo + payload vigente.

### `GET /api/social/themes/slug/:slug`

Alias de detalle para enlaces públicos.

### `POST /api/social/themes`

Crea draft del tema.

### `PATCH /api/social/themes/:id`

Edita metadata y visibilidad (owner only).

### `POST /api/social/themes/:id/version`

Crea nueva versión inmutable del payload.

### `POST /api/social/themes/:id/install`

Registra instalación/aplicación para métricas.

### `POST /api/social/themes/:id/rate`

Rating 1..5 y review opcional.

### `POST /api/social/themes/:id/feedback`

Feedback rápido (`issue|suggestion|praise`).

### `POST /api/social/themes/:id/report`

Reporte de abuso para moderación.

### `GET /api/social/themes/:id/export`

Descarga JSON canónico del tema.

### `GET /api/share/theme/:slug`

Endpoint público (sin auth) para distribución/import en links externos.

### `GET /api/admin/themes`

Cola admin de moderación de themes (`status=pending_review|approved|rejected|suspended|draft|all`).

### `GET /api/admin/themes/reports`

Cola admin de reportes (`status=open|resolved|dismissed|all`).

### `POST /api/admin/themes/:id/approve`

Aprueba un theme y limpia mensaje de moderación.

### `POST /api/admin/themes/:id/reject`

Rechaza un theme y publica mensaje de moderación al autor.

### `POST /api/admin/themes/:id/suspend`

Suspende un theme publicado y publica mensaje de moderación al autor.

### `POST /api/admin/themes/:id/restore`

Restaura un theme moderado al estado `approved`.

### `GET /api/admin/themes-health`

Reporte SLO operativo para dominio themes (social + admin) basado en métricas runtime de endpoints.

Incluye:

- `errorRate`
- `successRate`
- `p95LatencyMs`
- `avgLatencyMs`
- `breachingEndpoints`

Thresholds configurables por env:

- `THEMES_SLO_MAX_ERROR_RATE` (default `0.02`)
- `THEMES_SLO_MAX_P95_MS` (default `900`)
- `THEMES_SLO_MAX_AVG_MS` (default `450`)
- `THEMES_SLO_MIN_SAMPLES` (default `20`)

## Errores estándar

```json
{ "error": "not_found" }
{ "error": "forbidden" }
{ "error": "validation_error", "details": {} }
{ "error": "rate_limited" }
```

## Eventos realtime esperados

- `theme.updated`
- `theme.rating.updated`
- `theme.feedback.created`
- `theme.moderation.changed`

## Integración `pulse`

Agregar `domainVersions.themes` para invalidación incremental en móvil/web.

## Estado de implementación

- ✅ Fase 2 base implementada (`list`, `detail`, `create`, `version`, `install`).
- ✅ Fase 3 distribución implementada (`slug`, `export`, `share by slug`, carril web themes, import móvil por deep link).
- ✅ Fase 4 interacción implementada (`rate`, `feedback`, `report`) con recálculo de rating agregado y rate-limit dedicado.
- ✅ Fase 4 realtime implementada (invalidación incremental `themes` en pulse + eventos SSE de themes).
- ✅ Fase 5 moderación admin implementada (`THEMES_MODERATION`, endpoints admin de cola/acciones, auditoría `admin_audit_logs`, revalidación `/feed`).
- ✅ Fase 6 hardening/GA implementada (instrumentación de latencia por endpoint en social/admin themes, SLO report `admin/themes-health`, script de carga `npm run test:themes:load`, runbook operativo actualizado).
