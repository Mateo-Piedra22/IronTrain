# Theme Marketplace v1 — Diseño Técnico Ejecutable

## Estado del sistema (base real)

- Runtime de tema móvil operativo con `ThemeContext` y tokens core.
- Selector usuario actual limitado a `light | dark | system`.
- Motor de patches para subtema existente, aún no integrado al flujo activo.
- Feed/marketplace web existente para comunidad (rutinas/ejercicios) y panel admin de moderación ya en producción.
- Realtime social actual disponible (SSE + polling fallback) y reutilizable para dominio de temas.

## Actualización de ejecución (2026-04-01)

### Fase 1 completada (implementado)

- Runtime de subtemas integrado al `ThemeContext` real.
- Selección activa por modo persistida (`activeThemePackIdLight`, `activeThemePackIdDark`).
- CRUD local de drafts (`themeDrafts`) con validación de payload.
- `Theme Studio` integrado en Ajustes con:
  - edición semántica de tokens,
  - validación HEX en vivo,
  - preview dual Light/Dark,
  - aplicación selectiva por modo al guardar.

### Verificación ejecutada

- Tests de `theme-engine` y tokens en verde.
- Tests de hooks de tema (`useTheme`, `useColors`) en verde.

### Resultado operativo

- La base móvil quedó lista para conectarse al backend de dominio `themes` sin rehacer arquitectura local.

## Objetivo de producto

Habilitar un ecosistema completo de temas personalizados:

1. Crear paletas para modo claro, oscuro o ambos.
2. Previsualizar en vivo y aplicar inmediatamente.
3. Publicar en feed/market con visibilidad configurable.
4. Compartir, descargar, importar, actualizar y versionar.
5. Moderar desde admin con flujo de revisión y reportes.
6. Reaccionar, puntuar y dejar feedback en tiempo real.

## Decisión de arquitectura (v1)

- **Autoría principal en móvil**: el editor de temas se implementa primero en la app (ya existe runtime de tema).
- **Discovery + distribución en web y móvil**: feed, descarga, share links, perfil de autor y analítica.
- **Moderación centralizada en web admin**: cola de revisión y acciones de enforcement.
- **Modelo canónico en backend**: todas las entidades de temas viven en Postgres y se consumen por API social.
- **Realtime por dominio**: se agrega dominio `themes` a `pulse` y `stream` para invalidación incremental.

## Modelo de datos (nuevo dominio)

### 1) `theme_packs`

Representa un tema publicable/versionable.

- `id` (pk)
- `owner_id`
- `slug` (único global para URL)
- `name`
- `description`
- `tags` (jsonb array)
- `supports_light` (bool)
- `supports_dark` (bool)
- `visibility` (`private | friends | public`)
- `status` (`draft | pending_review | approved | rejected | suspended`)
- `moderation_message` (nullable)
- `current_version`
- `downloads_count`
- `applies_count`
- `rating_avg`
- `rating_count`
- `created_at`, `updated_at`, `deleted_at`

### 2) `theme_pack_versions`

Versiones inmutables del payload de tokens.

- `id` (pk)
- `theme_pack_id` (fk)
- `version` (int)
- `payload` (jsonb): incluye `lightPatch`, `darkPatch`, `meta`, `preview`
- `changelog` (text)
- `created_by`
- `created_at`
- unique(`theme_pack_id`, `version`)

### 3) `theme_pack_installs`

Instalaciones/aplicaciones por usuario.

- `id` (pk)
- `theme_pack_id` (fk)
- `user_id`
- `installed_version`
- `applied_light` (bool)
- `applied_dark` (bool)
- `installed_at`, `updated_at`
- unique(`theme_pack_id`, `user_id`)

### 4) `theme_pack_ratings`

Rating 1..5 y reseña opcional.

- `id` (pk)
- `theme_pack_id` (fk)
- `user_id`
- `rating` (smallint check 1..5)
- `review` (text nullable)
- `created_at`, `updated_at`, `deleted_at`
- unique(`theme_pack_id`, `user_id`)

### 5) `theme_pack_feedback`

Feedback rápido (ej: bug visual, contraste, rendimiento).

- `id` (pk)
- `theme_pack_id` (fk)
- `user_id`
- `kind` (`issue | suggestion | praise`)
- `message`
- `status` (`open | reviewed | closed`)
- `created_at`, `updated_at`

### 6) `theme_pack_reports`

Reportes de abuso/moderación.

- `id` (pk)
- `theme_pack_id` (fk)
- `reporter_user_id`
- `reason` (`nsfw | hate | spam | impersonation | malware | other`)
- `details`
- `status` (`open | triaged | actioned | dismissed`)
- `created_at`, `updated_at`

### 7) Extensión `activity_feed`

Nuevo `actionType`: `theme_shared`.

`metadata` incluye: `themePackId`, `slug`, `name`, `supportsLight`, `supportsDark`, `previewSeed`.

## Contrato de payload de tema (canónico)

```json
{
  "schemaVersion": 1,
  "base": { "light": "core-light", "dark": "core-dark" },
  "lightPatch": { "primary": { "DEFAULT": "#8AA0B8" }, "background": "#F6F7F9" },
  "darkPatch": { "primary": { "DEFAULT": "#FF8A80" }, "background": "#36434C" },
  "preview": {
    "hero": "#8AA0B8",
    "surface": "#FFFFFF",
    "text": "#0F172A"
  },
  "meta": {
    "name": "Nord Iron",
    "description": "Contraste alto frío",
    "tags": ["minimal", "high-contrast"]
  }
}
```

## API v1 (nueva superficie)

Base: `/api/social/themes`

- `GET /api/social/themes?scope=public&mode=light|dark|both&sort=trending|new|top&page=...`
- `GET /api/social/themes/:id`
- `GET /api/social/themes/slug/:slug`
- `POST /api/social/themes` (crear draft)
- `PATCH /api/social/themes/:id` (editar metadata/visibilidad)
- `POST /api/social/themes/:id/version` (nueva versión)
- `POST /api/social/themes/:id/publish` (envía a revisión o aprueba según policy)
- `POST /api/social/themes/:id/install`
- `POST /api/social/themes/:id/rate`
- `POST /api/social/themes/:id/feedback`
- `POST /api/social/themes/:id/report`
- `GET /api/social/themes/:id/export` (json descargable)

### Admin

Base: `/api/admin/themes`

- `GET /api/admin/themes?status=pending_review`
- `POST /api/admin/themes/:id/approve`
- `POST /api/admin/themes/:id/reject`
- `POST /api/admin/themes/:id/suspend`
- `POST /api/admin/themes/:id/restore`
- `GET /api/admin/themes/reports?status=open`

## Realtime

### Pulse

Agregar dominio `themes` al objeto `domainVersions`:

- `themes`: hash/versión derivado de últimos cambios en:
  `theme_packs`, `theme_pack_versions`, `theme_pack_ratings`, `theme_pack_feedback`, `theme_pack_reports`.

### Stream (SSE)

Nuevos eventos:

- `theme.published`
- `theme.updated`
- `theme.rating.updated`
- `theme.feedback.created`
- `theme.moderation.changed`

Cliente móvil/web invalida cache de listado/detalle sin full reload.

## UX funcional mínima (v1)

### Móvil

- Nuevo módulo `Theme Studio`:
  - Editor por token semántico.
  - Switch Light/Dark.
  - Vista previa en tiempo real sobre componentes reales.
  - Guardar draft, publicar, versionar.
- Feed social:
  - Tarjeta de tema con preview.
  - Switch de preview Light/Dark cuando aplique.
  - Instalar, puntuar, comentar.

### Web

- Feed público de temas en `view=marketplace` (3er carril junto a comunidad/market).
- Detalle de tema por `slug` con descarga JSON.
- Integración con share links.

### Admin UI

- Nueva pestaña `themes`.
- Cola de revisión pendiente + reportes.
- Acciones rápidas y mensaje de moderación.

## Reglas de validación y seguridad

- Validación estricta HEX (`#RRGGBB` o `#RRGGBBAA`) y tamaño máximo de payload.
- No se admiten claves desconocidas fuera del contrato.
- Verificación automática de contraste mínimo WCAG AA en tokens críticos.
- Sanitización de `name`, `description`, `tags`, `review`.
- Rate limit:
  - publicar tema
  - crear versión
  - puntuar/feedback/reportar
- Soft delete y auditoría admin para todas las acciones de moderación.

## Compatibilidad y migración

- No rompe el tema actual: `themeMode` sigue vigente.
- Si no hay `activeThemePack`, se usa catalog core actual.
- `SubthemePack` local se migra a `theme_packs` al primer publish.
- Export/import usa mismo formato JSON canónico para app y web.

## Métricas clave

- `theme_created`, `theme_published`, `theme_installed`, `theme_applied`, `theme_rated`, `theme_reported`.
- Conversión: `publish -> install`.
- Salud: ratio de rechazo moderación, ratio de reporte válido, churn por tema aplicado.

## Criterios de aceptación (v1)

1. Usuario crea tema claro/oscuro en móvil y lo aplica en vivo sin reinicio.
2. Usuario publica y aparece en feed público tras aprobación.
3. Otro usuario previsualiza (light/dark), instala, aplica, puntúa y deja feedback.
4. Admin puede aprobar/rechazar/suspender y dejar mensaje.
5. Cambios de rating/moderación reflejan en realtime en móvil/web.
6. Export JSON desde web e import en móvil funcional.
