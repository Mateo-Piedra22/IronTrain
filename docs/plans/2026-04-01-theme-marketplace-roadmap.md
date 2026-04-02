# Theme Marketplace v1 — Roadmap Ejecutable

## Objetivo operativo

Dejar el sistema listo para ejecutar por fases sin bloquear producto actual y sin regressions en social/feed.

## Fase 0 — Preparación (1 sprint corto)

### Alcance (Fase 0)

- Alinear contrato de tema canónico y convención de versionado.
- Definir feature flags (`theme_marketplace_enabled`, `theme_studio_enabled`).
- Preparar migraciones DB y contratos API.

### Entregables

- Schema SQL aprobado.
- Contratos TS para API y payload.
- Matriz de riesgos + rollback plan.

### Done (Fase 0)

- Build y tests verdes.
- Sin cambios funcionales expuestos a usuario final.

---

## Fase 1 — Runtime subtemas locales (móvil) (1 sprint)

### Alcance (Fase 1)

- Integrar `theme-engine` al `ThemeContext` real.
- Permitir activar subtema por modo (`light`, `dark`, ambos).
- CRUD local de drafts de tema (sin publicar aún).

### Tareas (Fase 1)

1. Extender estado de tema en configuración local:
   - `activeThemePackIdLight`
   - `activeThemePackIdDark`
2. Resolver tema activo por modo efectivo (`themeMode + systemScheme`).
3. Agregar `Theme Studio` básico con preview en vivo.
4. Guardar draft local validado.

### Done (Fase 1)

- Cambio de tema en vivo sin reinicio.
- Persistencia robusta entre sesiones.
- Validación de payload aplicada al guardar.

### Estado real (Fase 1)

- Estado: ✅ completada (2026-04-01).
- Entregable: Integración runtime de subtemas en `ThemeContext`.
- Entregable: Persistencia local para `themeDrafts`, `activeThemePackIdLight`, `activeThemePackIdDark`.
- Entregable: `Theme Studio` avanzado en Ajustes con preview dual Light/Dark y feedback de validación en vivo.
- Entregable: Tests específicos de engine de temas y validación de tokens en verde.

### Evidencia de validación (Fase 1)

- `npm run test -- src/utils/__tests__/theme-engine.test.ts src/utils/__tests__/theme.test.ts`.
- `npm run test -- src/utils/__tests__/theme.test.ts src/hooks/__tests__/useTheme.test.tsx src/hooks/__tests__/useColors.test.ts`.

### Gate de salida (Fase 1)

- Runtime dinámico operativo: ✅
- Persistencia local estable: ✅
- UX Studio (editor + preview): ✅
- Cobertura base de tests tema: ✅

---

## Fase 2 — Backend dominio themes (1–2 sprints)

### Alcance (Fase 2)

- Crear tablas del dominio themes.
- Exponer endpoints sociales base para listar, detalle, crear, versionar e instalar.

### Tareas (Fase 2)

1. Crear tablas e índices.
2. Implementar rutas:
   - `GET /api/social/themes`
   - `GET /api/social/themes/:id`
   - `POST /api/social/themes`
   - `POST /api/social/themes/:id/version`
   - `POST /api/social/themes/:id/install`
3. Extender `pulse` con dominio `themes`.
4. Registrar eventos de actividad `theme_shared`.

### Done (Fase 2)

- API funcional con validaciones y rate-limit.
- Integración con auth y ownership.
- Tests unitarios e integración para rutas críticas.

### Estado real (Fase 2)

- Estado: ✅ completada (2026-04-01).
- Entregable: tablas `theme_*` implementadas y migración `0012_theme_marketplace_phase2.sql` aplicada en Neon dev (`irontrain-maindb`).
- Entregable: endpoints base implementados (`list`, `detail`, `create`, `version`, `install`).
- Entregable: `domainVersions.themes` integrado en pulse social.
- Entregable: rate limits dedicados `SOCIAL_THEMES_READ|WRITE|INSTALL`.
- Entregable: hardening de concurrencia en install con incremento atómico de contadores.
- Nota de seguridad: evento de actividad `theme_shared` diferido al flujo `publish/approved` para evitar exposición de drafts en feed social.

### Evidencia de validación (Fase 2)

- `npm run test -- src/lib/theme-marketplace/themes-route-http.test.ts`.
- `npm run test -- src/lib/social/shared-routines-route-http.test.ts`.
- Verificación DB en Neon: tablas e índices `theme_*` presentes y consistentes.

---

## Fase 3 — Feed/market + distribución (1 sprint)

### Alcance (Fase 3)

- Mostrar temas en feed/marketplace (web + móvil).
- Preview Light/Dark y acciones instalar, compartir, descargar.

### Tareas (Fase 3)

1. Agregar carril `themes` en feed marketplace web.
2. Agregar cards de tema en feed móvil.
3. Implementar export/import JSON.
4. Deep links por slug.

### Done (Fase 3)

- Usuario descubre tema, preview, instala y aplica.
- Usuario comparte link de tema.
- Descarga JSON funcional desde website.

### Estado real (Fase 3)

- Estado: ✅ completada (2026-04-01).
- Entregable: carril `themes` integrado en feed web (`/feed?view=themes`) con preview y métricas.
- Entregable: detalle público por slug en web (`/share/theme/:slug`) con deep link y copy link.
- Entregable: endpoint de detalle por slug autenticado (`GET /api/social/themes/slug/:slug`).
- Entregable: endpoint export autenticado (`GET /api/social/themes/:id/export`).
- Entregable: endpoint público de distribución (`GET /api/share/theme/:slug`) con rate limit dedicado.
- Entregable: importador móvil de themes por deep link (`irontrain://share/theme/:slug`).

### Evidencia de validación (Fase 3)

- `npm run test -- src/lib/theme-marketplace/themes-route-http.test.ts src/lib/theme-marketplace/themes-phase3-route-http.test.ts`.
- Diagnóstico sin errores en rutas/api/page/screen de Fase 3.

---

## Fase 4 — Rating, feedback y realtime (1 sprint)

### Alcance (Fase 4)

- Puntuación, reseñas y feedback.
- Realtime de cambios de rating/moderación.

### Tareas (Fase 4)

1. Endpoints:
   - `POST /rate`
   - `POST /feedback`
   - `POST /report`
2. Agregar eventos SSE de themes.
3. Recalcular agregados de rating.

### Done (Fase 4)

- Rating y feedback visibles en tiempo real.
- Desacople correcto entre cache local y cache servidor.

### Estado real (Fase 4)

- Estado: ✅ completada (2026-04-01).
- Entregable: endpoints `POST /api/social/themes/:id/rate`, `POST /api/social/themes/:id/feedback`, `POST /api/social/themes/:id/report` implementados.
- Entregable: recálculo de agregados `ratingAvg/ratingCount` transaccional tras cada rating.
- Entregable: control anti-abuso endurecido con rate-limit dedicado `SOCIAL_THEMES_INTERACT`.
- Entregable: autorización robusta unificada con validación real de amistad para visibilidad `friends`.
- Entregable: realtime extendido en `pulse` para detectar cambios de ratings/feedback/reports y emisión SSE granular:
   - `theme.updated`
   - `theme.rating.updated`
   - `theme.feedback.created`
   - `theme.moderation.changed`

### Evidencia de validación (Fase 4)

- `npm run test -- src/lib/theme-marketplace/themes-route-http.test.ts src/lib/theme-marketplace/themes-phase3-route-http.test.ts src/lib/theme-marketplace/themes-phase4-route-http.test.ts`.
- 12/12 tests en verde (fases 2-4).
- Diagnóstico sin errores en archivos de rutas, servicio, pulse y stream.

---

## Fase 5 — Moderación admin themes (1 sprint)

### Estado

- ✅ Completada (backend + UI admin + auditoría + tests + documentación).

### Alcance (Fase 5)

- Extender admin con cola de revisión de temas.
- Acciones approve/reject/suspend y gestión de reportes.

### Tareas (Fase 5)

1. Nueva pestaña admin `THEMES_MODERATION`.
2. Acciones server seguras con auditoría.
3. Mensajes de moderación hacia autor.
4. Revalidación de feed en cambios de estado.

### Done (Fase 5)

- Moderación completa end-to-end.
- Todo cambio queda en `admin_audit_logs`.

### Evidencia técnica

- Nuevos endpoints admin de moderación:
   - `GET /api/admin/themes`
   - `GET /api/admin/themes/reports`
   - `POST /api/admin/themes/:id/approve`
   - `POST /api/admin/themes/:id/reject`
   - `POST /api/admin/themes/:id/suspend`
   - `POST /api/admin/themes/:id/restore`
- Nueva pestaña admin `THEMES_MODERATION` con cola de temas + cola de reportes.
- Acción server segura para moderación (`handleThemeModerationAction`) con `requireAdminAction` y revalidación de `/admin` + `/feed`.
- Servicio reusable de moderación transaccional en `src/lib/theme-marketplace/admin-moderation.ts`.
- Tests HTTP de FASE 5:
   - `src/lib/theme-marketplace/themes-phase5-admin-route-http.test.ts`.

---

## Fase 6 — Hardening + GA (1 sprint)

### Estado real (Fase 6)

- Estado: ✅ completada (2026-04-02).
- Entregable: observabilidad extendida en endpoints `social.themes.*` y `admin.themes.*` con métricas de latencia (`avg/p95`) y clasificación por outcome/status.
- Entregable: contrato SLO de themes en `src/lib/theme-marketplace/themes-api-slo.ts` con thresholds configurables por entorno.
- Entregable: endpoint operativo `GET /api/admin/themes-health` con auditoría admin y reporte de salud por namespace (`social`, `admin`).
- Entregable: script reproducible de carga `npm run test:themes:load` para stress de rutas críticas (`list/detail/install/rate/report`).
- Entregable: documentación operativa actualizada en runbook + README del dominio.

### Evidencia de validación (Fase 6)

- `npm run test -- src/lib/endpoint-metrics.test.ts src/lib/theme-marketplace/themes-api-slo.test.ts src/lib/theme-marketplace/themes-phase6-health-route-http.test.ts`.
- `npm run test -- src/lib/theme-marketplace/themes-route-http.test.ts src/lib/theme-marketplace/themes-phase3-route-http.test.ts src/lib/theme-marketplace/themes-phase4-route-http.test.ts src/lib/theme-marketplace/themes-phase5-admin-route-http.test.ts`.
- `npm run test:themes:load` (con `THEMES_LOAD_TOKEN` y opcionalmente `THEMES_LOAD_THEME_ID`).

### Alcance (Fase 6)

- Observabilidad, rendimiento y protección anti-abuso.

### Tareas (Fase 6)

1. Métricas analíticas y dashboards.
2. SLOs para endpoints de themes.
3. Pruebas de carga en feed themes.
4. Playbook de incidentes y rollback.

### Done (Fase 6)

- KPIs medidos y estables.
- Error budget definido.
- Feature flags listas para rollout gradual.

---

## Dependencias críticas

- Extensión de `schema.ts` y migración en Neon/Postgres.
- Reutilización de auth social existente.
- Integración con `pulse/stream` actuales.
- QA visual para contraste y accesibilidad.

## Preparación inmediata para Fase 2

### Checklist ready-to-start

1. Generar migración real desde [website/src/db/theme-marketplace-blueprint.sql](website/src/db/theme-marketplace-blueprint.sql).
2. Extender `website/src/db/schema.ts` con tablas `theme_*` y relaciones.
3. Crear rutas iniciales:
   - `GET /api/social/themes`
   - `GET /api/social/themes/:id`
   - `POST /api/social/themes`
   - `POST /api/social/themes/:id/version`
   - `POST /api/social/themes/:id/install`
4. Implementar validación de contrato usando [website/src/lib/theme-marketplace/contracts.ts](website/src/lib/theme-marketplace/contracts.ts).
5. Integrar invalidación incremental en `pulse` con `domainVersions.themes`.
6. Añadir test de integración HTTP por endpoint crítico de Fase 2.

### Definition of Ready (Fase 2)

- Modelo `theme_*` definido en DB y migración aplicable en entorno de desarrollo.
- Endpoints base responden con auth/ownership correctos.
- Contratos request/response alineados con `README` de API.
- Test suite de rutas críticas en verde.

## Riesgos y mitigación

1. **Payloads inválidos** → validación Zod + fallback a core theme.
2. **Abuso de publicaciones** → rate limit + estado `pending_review` por defecto.
3. **Regresión visual** → snapshots de tokens + test de contraste.
4. **Desfase realtime** → fallback polling ya existente.

## Rollout recomendado

- Semana 1: internal dogfood (`theme_studio_enabled` solo staff).
- Semana 2: beta cerrada (creadores limitados).
- Semana 3: publicación pública con moderación obligatoria.
- Semana 4: activar ratings/feedback para todos.
