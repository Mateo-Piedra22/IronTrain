# IronTrain Broadcast Hub: Plan de Unificación y Automatización

## 1. Resumen Ejecutivo

El sistema de contenido “broadcast” de IronTrain (novedades, changelogs, anuncios, eventos globales) hoy está fragmentado en múltiples flujos, lógicas y contratos:

- App:
  - Pantalla de novedades (`app/changelog.tsx`) combina changelog + anuncios.
  - Handler global (`components/GlobalNoticeHandler.tsx`) decide por su cuenta cuándo mostrar modales/toasts.
- Backend (website):
  - Changelogs (`/api/changelogs`) con sync github->db.
  - Notificaciones/anuncios (`/api/notifications`) con segmentación/capping.
  - Reacciones de changelog: offline-first (sync engine) + tabla `changelog_reactions`.
  - Reacciones de notifications: online-only (`/api/notifications/react`).
  - Eventos globales: se gestionan en admin y alimentan el sistema social por endpoints separados.

Esto genera deuda técnica “enterprise-blocking”:

- Reglas duplicadas y divergentes.
- Experiencia de usuario inconsistente (dos entrypoints, prioridades distintas).
- Engagement/reactions con dos modelos distintos (sync vs online).
- Zero Trust parcial en endpoints de analytics/logging.

Este plan define una estrategia **por fases y compatible** (no “big bang”), que mantiene el admin existente pero lo ordena y lo convierte en un “Command Center” real para Broadcast.

---

## 2. Objetivos No Negociables

- **Un solo modelo mental** en app para “Novedades”: feed unificado + reglas claras para interrupciones (modal/toast).
- **Una sola capa de reglas** en backend para targeting y visibilidad (plataforma, versión, segmento, vigencia, prioridad).
- **Zero Trust**:
  - Autenticación y scoping en cada endpoint.
  - No confiar en `userId` enviado por query/body cuando hay auth disponible.
  - Validación estricta de inputs y allowlists.
- **Automatización**:
  - Changelog y anuncios deben poder generarse/actualizarse automáticamente por eventos externos (ej. releases).
  - Eventos globales deben poder generar contenido derivado (anuncio) sin duplicación manual.
- **Calidad**:
  - Cambios de lógica deben venir con tests (unit/integration) obligatoriamente.

---

## 3. Estado Actual (Mapa Real del Repo)

### 3.1 Changelog
- App consume `website/app/api/changelogs/route.ts` vía `src/services/ChangelogService.ts`.
- Cache local por archivo + fallback a `changelog.generated.json`.
- Reacciones: SQLite `changelog_reactions` y sync engine (`/api/sync/push|pull`).

### 3.2 Anuncios / Notificaciones (admin_notifications)
- App consume `website/app/api/notifications/route.ts` vía `src/services/AppNotificationService.ts`.
- Lógica de segmentación y capping está en el endpoint de notifications.
- Reacciones: endpoint `website/app/api/notifications/react/route.ts` (online-only).
- Logs: `website/app/api/notifications/log/route.ts`.

### 3.3 Eventos Globales (global_events)
- Admin escribe en `global_events` (server action `handleGlobalEventAction`).
- App ve evento activo desde endpoints sociales (`SocialService.getProfile()`).

---

## 4. Decisión de Arquitectura (Estrategia)

Se implementará un **Broadcast Hub** por fases:

- **Primero**: unificación lógica (DTO + endpoint agregador), sin migrar tablas.
- **Después**: consolidación de UI y reglas en app.
- **Luego**: decidir si reactions/logs se vuelven offline-first (sync) o se mantienen online con semántica alineada.
- **Finalmente**: automatizaciones (GitHub webhooks) y potencial migración física a un esquema unificado si conviene.

Motivo: reduce riesgo, evita romper sync/offline, y permite entregar valor incremental.

---

## 5. Fase 0 — Hardening y Zero Trust (Preparación)

### 5.1 Endurecer logs de notifications
**Problema**: `notifications/log` acepta `action` libre y permite `anonymous`.

**Acciones**:
- Allowlist de `action`: `seen`, `clicked`, `closed`.
- Validación de payload y tamaño de `metadata`.
- Rate limiting básico (por `userId` + `notificationId` + ventana temporal).
- Cuando hay auth, no aceptar identidad desde body.

**Archivos**:
- `website/app/api/notifications/log/route.ts`

**Tests obligatorios**:
- Acción inválida => 400.
- Sin auth => 401.
- Payload válido => 200.

### 5.2 Endurecer reactions de notifications
**Problema**: contrato divergente respecto a changelog reactions; contador puede volverse negativo; el toggle hace delete físico.

**Acciones**:
- Idempotencia real.
- Contador no negativo.
- Definir semántica consistente (ideal: soft-delete) o asegurar invariantes si se mantiene delete físico.

**Archivos**:
- `website/app/api/notifications/react/route.ts`
- `website/src/db/schema.ts` (si se agregan columnas o constraints)

**Tests obligatorios**:
- Toggle repetido no corrompe contador.
- `reactionCount` nunca < 0.

---

## 6. Fase 1 — Contrato Unificado (BroadcastItem) + Endpoint Agregador

### 6.1 DTO: BroadcastItem
Definir un único contrato que represente:
- changelog
- announcement
- global_event (como card derivada)

Campos mínimos:
- `id`
- `kind`: `changelog | announcement | global_event`
- `title`
- `body`/`summary`
- `priority`
- `targeting`: `platform`, `version`, `segment`
- `lifecycle`: `startsAt`, `endsAt`, `isActive`
- `actionUrl` (deep link normalizado)
- `engagement`: `reactionCount` (y `userReacted` si aplica)

### 6.2 Endpoint nuevo: `/api/broadcast/feed`
**Responsabilidad**: entregar una lista unificada aplicando reglas una sola vez.

Reglas:
- Orden: prioridad + recencia.
- Filtros: plataforma/versión.
- Segmentación: según perfil y actividad.
- Expiración.
- Política especial para “feed” vs “interrupción” se define como flags en el item.

**Archivos**:
- Nuevo: `website/app/api/broadcast/feed/route.ts`
- Nuevo: `website/src/lib/broadcast/*` (normalización, ordenamiento, reglas, validaciones)

**Tests obligatorios**:
- Ordenamiento consistente.
- Filtrado por plataforma/versión.
- Segmentación correcta.

---

## 7. Fase 2 — Admin como Command Center de Broadcast (sin reemplazarlo)

### 7.1 Reordenar “PUBLICADOR_UNIFICADO” por subdominios
- Announcements: targeting + preview + push.
- Changelog: github->db sync + release publishing.
- Global Events: CRUD + “crear anuncio derivado”.

### 7.2 Automatizaciones desde Admin
- Al activar evento global, permitir generar anuncio derivado con 1 click.
- Al publicar changelog (pasar de unreleased -> released), emitir push consistente.

**Archivos**:
- `website/app/admin/actions.ts`
- `website/app/admin/components/ContentManagementPanel.tsx`
- `website/app/admin/page.tsx`

**Tests**:
- Server actions: auth admin requerida y validación de inputs.

---

## 8. Fase 3 — App: Un Solo News Hub + Un Solo Motor de Interrupciones

### 8.1 Pantalla de Novedades
- Migrar `app/changelog.tsx` a consumir `/api/broadcast/feed`.
- Mostrar items por kind (changelog, anuncio, evento) con un renderer común.

### 8.2 GlobalNoticeHandler
- Dejar de consultar 2 servicios por separado.
- Consumir Broadcast feed y aplicar política de “interrupción” (modal/toast) basada en:
  - `priority`
  - `displayMode`
  - `kind`
  - “ya visto” local

**Archivos**:
- `app/changelog.tsx`
- `components/GlobalNoticeHandler.tsx`
- `src/services/AppNotificationService.ts`
- `src/services/ChangelogService.ts`

**Tests obligatorios**:
- Reglas de show modal/toast.
- No bloquear navegación.

---

## 9. Fase 4 — Offline-first (Decisión y Ejecución)

### 9.1 Opciones
- Opción A: feed online + reactions online (pero consistentes, con invariantes fuertes).
- Opción B: feed online + reactions offline (integrar `notification_reactions` al sync engine).

Recomendación:
- Mantener feed online (por targeting dinámico).
- Evaluar offline para reactions solo si aporta valor real.

**Archivos potenciales**:
- `website/app/api/sync/push/route.ts`
- `website/app/api/sync/pull/route.ts`
- `src/services/DatabaseService.ts`

---

## 10. Fase 5 — Automatización GitHub (Releases/Webhooks)

- Webhook verificado (firma) para releases.
- Upsert changelog + (opcional) anuncio derivado.

**Archivos**:
- Nuevo: `website/app/api/webhooks/github/route.ts`
- `website/src/lib/changelog-db-sync.ts`

**Tests**:
- Firma inválida => rechazo.
- Payload duplicado => idempotente.

---

## 11. Checklist de Archivos Implicados (Realista)

### Website
- `website/app/api/broadcast/feed/route.ts` (nuevo)
- `website/src/lib/broadcast/*` (nuevo)
- `website/app/api/notifications/route.ts`
- `website/app/api/notifications/react/route.ts`
- `website/app/api/notifications/log/route.ts`
- `website/app/api/sync/push/route.ts`
- `website/app/api/sync/pull/route.ts`
- `website/app/admin/actions.ts`
- `website/app/admin/components/ContentManagementPanel.tsx`
- `website/app/admin/page.tsx`

### App
- `app/changelog.tsx`
- `components/GlobalNoticeHandler.tsx`
- `src/services/AppNotificationService.ts`
- `src/services/ChangelogService.ts`

---

## 12. Criterios de Éxito

- Admin puede gestionar anuncios, changelog y eventos globales con separación clara.
- App consume un feed unificado.
- GlobalNoticeHandler y News screen comparten fuente.
- Reactions/logs no rompen invariantes y están bajo Zero Trust.
- Tests cubren la lógica de negocio y reglas de targeting.
