# Arquitectura

## Documentos relacionados

- [Runbook operacional](RUNBOOK.md)
- [Seguridad y privacidad](SECURITY_PRIVACY.md)

## 1) Objetivo del sistema

IronTrain prioriza una experiencia de entrenamiento confiable en mobile, con persistencia local-first y capacidades sociales progresivas.

Objetivos técnicos principales:

- Alta resiliencia offline en app mobile.
- Evolución segura del esquema de datos local.
- Integración social sin duplicación de rutinas ni pérdida de estado.
- Pipeline CI/CD con guardrails de calidad y seguridad.

## 2) Mapa de sistemas

### 2.1 Módulo principal: Mobile app (raíz del repo)

- Framework: Expo SDK 54 + React Native 0.81 + React 19.
- Enrutado: Expo Router (`app/`).
- Estado global: Zustand.
- Persistencia local: SQLite (`expo-sqlite`) vía `DatabaseService`.
- Componentes UI y pantallas: `components/`, `app/`.
- Lógica de dominio: `src/services`, `src/hooks`, `src/store`.

### 2.2 Módulo secundario: Website (`website/`)

- Framework: Next.js 15 (App Router).
- Persistencia: Postgres/Neon.
- Acceso a DB: Drizzle ORM.
- Tooling separado (build/test/deploy propios).

### 2.3 Integración entre módulos

- Comparten lineamientos de producto, pero no runtime.
- El website sincroniza contenido desde raíz mediante scripts dedicados.
- Los despliegues son independientes (mobile release vs website deploy).

## 3) Arquitectura mobile por capas

## 3.1 Presentación

- `app/`: rutas, layouts y entrypoints de pantallas.
- `components/`: UI reutilizable, modales, widgets y piezas social.
- Principio: mantener vista declarativa y mover reglas de negocio fuera de la pantalla.

## 3.2 Estado y orquestación

- Stores con Zustand (`src/store`).
- Hooks de composición/lectura derivada (`src/hooks`, `src/social/*`).
- Servicios como boundary para IO (DB/red).

## 3.3 Dominio y servicios

- `RoutineService`: creación/edición/import/sync de rutinas.
- `SocialService`: contratos de red social (friends/feed/shared workspaces).
- `DatabaseService`: esquema, migraciones y acceso SQLite.

## 3.4 Persistencia local

- Fuente primaria de lectura/escritura en la app.
- Tablas de entrenamiento, librería, social cache y links de sync.
- La tabla `shared_routine_links` evita duplicación de rutina local al sincronizar payloads compartidos.

## 4) Flujo de datos clave

## 4.1 Entrenamiento local

1. Usuario interactúa en pantalla.
2. Store/hook orquesta acción.
3. Servicio de dominio persiste en SQLite.
4. Se emiten eventos para refrescar pantallas relacionadas.

## 4.2 Social feed y notificaciones

1. `SocialService` obtiene datos remotos.
2. Se proyectan en estado local/store.
3. Interacciones (kudos, seen, accept/reject) actualizan estado optimista y luego sincronizan.

## 4.3 Rutinas compartidas (workspace)

1. Usuario importa/sincroniza snapshot remoto.
2. `RoutineService.syncSharedRoutinePayload` decide crear o reutilizar rutina local.
3. Se actualiza `shared_routine_links` con snapshot/revisión aplicada.
4. En conflictos de revisión, backend responde 409 y el cliente ejecuta estrategia de resolución.

## 5) Contratos y compatibilidad

- Los contratos sociales están tipados en `SocialService`.
- Se prioriza backward compatibility en payloads y migraciones.
- Cualquier cambio de contrato debe acompañarse con:
  - fallback en cliente,
  - validación de errores,
  - documentación.

## 6) No-funcionales

## 6.1 Disponibilidad percibida

- Mobile sigue operativa sin red para la mayor parte del flujo core.
- Reintentos y sincronización diferida para acciones remotas.

## 6.2 Mantenibilidad

- Separación clara UI / estado / servicios.
- Tipado explícito para minimizar regressions silenciosas.

## 6.3 Seguridad

- Workflows con permisos mínimos.
- Análisis continuo (CodeQL + audit deps + dependency review).

## 7) CI/CD en arquitectura

- `ci.yml`: calidad funcional y de compilación.
- `security.yml`: seguridad continua.
- `release-android.yml`: publicación Android controlada por semver tag.

Este pipeline actúa como “capa de control” de arquitectura para frenar degradaciones antes de merge/release.

## 8) Decisiones arquitectónicas actuales

- Local-first en mobile como pilar principal.
- Website desacoplado para velocidad de iteración independiente.
- Sincronización social/rutinas compartidas con estrategia explícita de conflictos (revisión/baseRevision/force en casos controlados).

## 9) Riesgos técnicos abiertos

- Complejidad creciente del módulo social en UI monolítica de pantallas.
- Riesgo de drift entre docs históricas y estado real del código.
- Dependencia de configuración correcta en GitHub Settings para branch protection.

## 10) Lineamientos para cambios futuros

1. No introducir lógica de negocio compleja directamente en componentes de pantalla.
2. Mantener migraciones idempotentes y backward-compatible.
3. Cualquier feature social nueva debe definir:
   - contrato,
   - manejo de conflicto,
   - estrategia de rollback.
4. Mantener sincronizada esta documentación con cambios estructurales.
