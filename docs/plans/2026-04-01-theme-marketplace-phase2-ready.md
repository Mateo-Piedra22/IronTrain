# Theme Marketplace v1 — Fase 2 Ready Checklist

## Objetivo

Tener todo listo para comenzar implementación backend de dominio `themes` sin ambigüedad y con criterios de aceptación verificables.

## Artefactos base ya disponibles

- Diseño técnico: [2026-04-01-theme-marketplace-design.md](./2026-04-01-theme-marketplace-design.md)
- Roadmap actualizado: [2026-04-01-theme-marketplace-roadmap.md](./2026-04-01-theme-marketplace-roadmap.md)
- Blueprint SQL: [../../website/src/db/theme-marketplace-blueprint.sql](../../website/src/db/theme-marketplace-blueprint.sql)
- Contratos TS: [../../website/src/lib/theme-marketplace/contracts.ts](../../website/src/lib/theme-marketplace/contracts.ts)
- Blueprint API: [../../website/app/api/social/themes/README.md](../../website/app/api/social/themes/README.md)

## Scope exacto de Fase 2

1. Persistencia backend de `theme_packs` y entidades relacionadas.
2. Endpoints base de dominio `themes` (list, detail, create, version, install).
3. Integración con auth/ownership existente.
4. Invalidación incremental vía `pulse`.
5. Test de integración por endpoint crítico.

## Orden recomendado de ejecución

### Paso 1 — DB

- Extender `website/src/db/schema.ts` con tablas `theme_*` y relaciones.
- Crear migración formal basada en `theme-marketplace-blueprint.sql`.
- Verificar índices y constraints en entorno de desarrollo.

### Paso 2 — Capa de dominio

- Crear módulo `website/src/lib/theme-marketplace/` para:
  - validación de payload,
  - acceso a DB,
  - mapeo DTO <-> contrato.
- Reusar contratos de `contracts.ts` como fuente única de tipos.

### Paso 3 — API routes

- Implementar rutas:
  - `GET /api/social/themes`
  - `GET /api/social/themes/:id`
  - `POST /api/social/themes`
  - `POST /api/social/themes/:id/version`
  - `POST /api/social/themes/:id/install`

### Paso 4 — Realtime/pulse

- Extender `domainVersions` con `themes`.
- Invalidar cache de listado y detalle cuando cambie dominio `themes`.

### Paso 5 — Testing

- Test de integración HTTP por ruta crítica.
- Casos mínimos:
  - autorización,
  - ownership,
  - validación de payload,
  - respuestas de error estandarizadas.

## Definition of Ready (Fase 2)

- [x] Migración DB aplicada en dev sin errores.
- [x] Contratos API alineados con implementación.
- [x] Endpoints base responden correctamente con auth.
- [x] Pulse invalida `themes` de forma incremental.
- [x] Test suite Fase 2 en verde.

## Estado de ejecución real (2026-04-01)

- Implementado esquema `theme_*` en `schema.ts` + migración `0012_theme_marketplace_phase2.sql`.
- Implementada capa de dominio `theme-marketplace/service.ts` con validación, filtros y helpers de slug/listado.
- Implementados endpoints base de Fase 2:
  - `GET /api/social/themes`
  - `GET /api/social/themes/:id`
  - `POST /api/social/themes`
  - `POST /api/social/themes/:id/version`
  - `POST /api/social/themes/:id/install`
- Integrado `domainVersions.themes` en pulse social.
- Agregados rate limits `SOCIAL_THEMES_READ|WRITE|INSTALL`.
- Endurecido `install` con incremento atómico de contadores para reducir riesgo de race condition.
- Validación ejecutada:
  - tests de `themes-route-http.test.ts` en verde,
  - test social existente (`shared-routines-route-http`) en verde,
  - sin errores de diagnóstico en archivos de Fase 2.

## Riesgos inmediatos y control

- Drift entre contrato y DB → validar con mapeadores tipados únicos.
- Inconsistencia de ownership → centralizar checks de autor en capa de dominio.
- Realtime incompleto → fallback polling hasta completar stream.
- Payload inválido → validar temprano y rechazar con `validation_error`.
