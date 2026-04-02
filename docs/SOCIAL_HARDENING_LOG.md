# Social Hardening Log

Fecha inicio: 2026-04-01
Estado: En progreso

## Objetivo

Consolidar la nueva capa Social/Workspace con foco en mantenibilidad, robustez y reducción de deuda técnica sin cambiar UX.

## Alcance de esta tanda

1. Adoptar hooks ya creados para reducir complejidad en `social.tsx`.
2. Registrar riesgos críticos detectados y su estado.
3. Dejar plan de hardening por fases con acciones ejecutables.

## Mapeo rápido (estado actual)

- `src/social/useSocialDerivedData.ts`: existe, sin uso.
- `src/social/useSocialActions.ts`: existe, sin uso.
- Alias `sharedSpace/*`: retirados de código activo y wrappers eliminados (solo referencias históricas en este log).
- `shared_routine_links` ya existe con índice único por `(shared_routine_id, user_id)`.

## Riesgos y bugs (vivos)

- [x] R1: Hooks de dominio no adoptados (deuda de arquitectura). (Mitigado en `social.tsx`)
- [ ] R2: Monolito en `app/(tabs)/social.tsx` (acoplamiento alto).
- [x] R3: Monolito en `components/social/RoutineWorkspaceManagerModal.tsx` mitigado por separación por responsabilidades.
- [~] R4: Dualidad semántica `space/workspace` reducida; queda homogeneización de copy/naming interno.
- [x] R5: Riesgo de duplicado con `user_id NULL` en índice único SQLite. (Mitigado)
- [x] R6: Deriva funcional tras migración parcial a hooks (lógica duplicada/desconectada). (Mitigado)
- [x] R7: Datos remotos huérfanos pueden romper pull local por FK en SQLite. (Mitigado + saneamiento remoto + FK validada)

## Cambios ejecutados en esta sesión

- [x] C1: Integrar `useSocialDerivedData` en `social.tsx`.
- [x] C2: Integrar `useSocialActions` en `social.tsx`.
- [x] C3: Validar compilación y documentar resultado.
- [x] C4: Endurecer unicidad de `shared_routine_links` para `user_id NULL`.

### Evidencia de ejecución (2026-04-01)

- `social.tsx` ahora delega:
 	- Derivación base (`incomingFriendRequestsList`, `notificationShares`, `allActivityFeedItems`) a `useSocialDerivedData`.
 	- Handlers transaccionales (`friend`, `inbox`, `kudos`, `seen`, `copyId`) a `useSocialActions`.
- Se mantuvo búsqueda con debounce existente para no alterar UX.
- Validación local por archivo: sin errores en `app/(tabs)/social.tsx`.
- `DatabaseService` usa índice único normalizado en `shared_routine_links`:
 	- `UNIQUE(shared_routine_id, ifnull(user_id, '__anon__'))`

### Evidencia de ejecución (2026-04-01 · tanda 2)

- Se extrajo `useSocialSearch`:
 	- Encapsula debounce (250ms), requestId anti-race y guardas de query mínima.
 	- `social.tsx` elimina estado/efectos locales de búsqueda y delega al hook.
- Se extrajo `useSocialRealtimeLifecycle`:
 	- Encapsula `focus start/stop`, refresh de ubicación periódico y callback de analytics.
 	- `social.tsx` elimina bloque inline de ciclo realtime y mantiene comportamiento.
- Se agregaron pruebas en `SocialService.test.ts` para:
 	- 409 con `SHARED_ROUTINE_REVISION_CONFLICT` -> `SocialApiError` tipado con `status/code/payload`.
 	- respuesta de error con body vacío -> `SocialApiError` sin fallo de parseo.

### Evidencia de ejecución (2026-04-01 · tanda 3: auditoría paranoica + P1)

- Auditoría de paridad de migración (sin asumir que “porque existe está bien”):
 	- Se detectó lógica de búsqueda residual en `useSocialActions` (duplicada respecto de `useSocialSearch`).
 	- Se detectó `SocialNotificationsModal` con soporte de `activityAlerts` no cableado desde `social.tsx`.
- Correcciones aplicadas:
 	- `useSocialActions` ahora se enfoca solo en acciones de dominio (se quitó búsqueda residual y props asociadas).
 	- `social.tsx` ahora pasa `activityAlerts` y `onOpenActivity` al modal de notificaciones.
 	- Se extrajo nueva P1: `useSocialTabs` (estado/tab switch centralizado) y se integró en `social.tsx`.
- Validación:
 	- `get_errors`: sin errores en archivos tocados.
 	- `SocialService.test.ts`: 6/6 en verde.

### Incidente puntual (2026-04-01 · Sync conflict FK)

- Síntoma reportado: `NativeStatement.finalizeAsync ... FOREIGN KEY constraint failed` durante resolución de conflicto (`merge`).
- Verificación en Neon producción (`project=IronTrain`, `db=irontrain-maindb`):
 	- Se detectaron `96` filas huérfanas en `routine_exercises` con `routine_day_id` inexistente.
 	- El schema remoto actual no expone FK en esas tablas (`information_schema` sin constraints), por lo que los huérfanos existen en nube.
- Impacto: al hacer pull hacia SQLite local (que sí tiene FK), esos registros disparan error y abortan sync.
- Mitigación aplicada (cliente):
 	- `SyncService.pullRemoteChanges` ahora salta filas con violación FK y continúa el sync en lugar de abortar todo.
 	- Se registra warning estructurado con conteo por tabla (`skippedFkRowsByTable`).
 	- Test de regresión agregado: `skips permanently FK-invalid rows without crashing pull`.
- Estado: app resiliente frente al problema; falta saneamiento remoto para eliminar huérfanos.

### Impacto de esta tanda

- Menor duplicación de lógica social en pantalla.
- Mejor testabilidad de acciones y derivaciones al quedar centralizadas en hooks.
- `social.tsx` sigue grande (riesgo R2 vigente), pero con una primera reducción de acoplamiento.

## Plan de robustecimiento

### Fase 1 (rápida, 1-2 días)

- Adoptar hooks de derivación/acciones en `social.tsx`.
- Agregar guardas de concurrencia por acción sensible (publicar/review/rollback).
- Dejar checklist de retiro de aliases.

### Fase 2 (1 sprint)

- Extraer sub-hooks del manager de workspace: miembros, invitaciones, reviews, sync, rollback.
- Añadir pruebas para conflictos 409 + forzado + rollback.

### Fase 3 (1 sprint)

- Retiro gradual de aliases `sharedSpace/*`.
- Unificación de naming y contratos tipados únicos.

## Backlog de reparaciones y mejoras (priorizado)

### P1 (alto impacto / corto-medio esfuerzo)

- [x] Adoptar hooks de dominio en `social.tsx` (`useSocialActions`, `useSocialDerivedData`).
- [x] Endurecer unicidad `shared_routine_links` con `ifnull(user_id, '__anon__')`.
- [x] Extraer bloques de `social.tsx` en sub-hooks de UI (`useSocialSearch`, `useSocialTabs`, `useSocialRealtimeLifecycle`).
- [x] Partir `RoutineWorkspaceManagerModal` por responsabilidad: `members`, `invitations`, `reviews`, `sync`, `rollback`.

### P2 (alto impacto / medio esfuerzo)

- [x] Suite de tests de conflictos 409 (`sync`, `owner-sync`, `review`, `rollback`) en `SocialService.test.ts`.
- [x] Métrica técnica mínima base: conflictos/fallos en endpoints sensibles social + eventos de auto-sync (`attempted/applied/skipped/error`).
- [x] Locks de concurrencia por `workspaceId` para acciones sensibles de publicación/decisión (helper unificado).

### P3 (impacto medio / corto esfuerzo)

- [x] Definir fecha de retiro para aliases `sharedSpace/*` y checklist de migración.
- [x] Homogeneizar copy `workspace` y eliminar dualidad semántica `space/workspace` en código activo.
- [~] Revisar `any` residuales y normalizar tipos en componentes sociales.

## Próxima tanda sugerida (ejecutable)

1. Partir `RoutineWorkspaceManagerModal` en módulos por responsabilidad (`members`, `invitations`, `reviews`, `sync`, `rollback`) sin alterar UX.
2. Agregar tests de integración HTTP de rutas `shared-routines` (no solo cliente) para validar códigos/metrics/locks.
3. Homogeneizar copy/naming residual `space/workspace` en UI y variables internas.

## Criterios de cierre de la tanda

- `social.tsx` delega derivación y acciones en hooks compartidos.
- Sin errores TypeScript/Jest por cambios de esta tanda.
- Este documento actualizado con estado real de ejecución.

### Evidencia de ejecución (2026-04-01 · causa raíz + parches definitivos)

- Forense de correlación cerrado en producción (`irontrain-maindb`):
 	- Usuario afectado: `mateo` (`053e682f-ef13-4ef3-b5eb-0d17784ad857`).
 	- En el minuto del incidente hubo `128` `routine_exercises`, de los cuales `96` quedaron huérfanos, y solo `4` `routine_days` válidos para esa misma rutina.
 	- Patrón compatible con reemplazo concurrente de rutina compartida + deduplicación posterior.
- Hipótesis confirmada por código:
 	- El flujo de workspace puede disparar sincronizaciones solapadas de snapshot local (`RoutineWorkspaceManagerModal` + `RoutineService.syncSharedRoutinePayload`).
 	- `repairDataConsistency` deduplicaba `routine_days` con FK desactivadas borrando duplicados sin reubicar hijos `routine_exercises`.
- Parches aplicados (definitivos, no temporales):
 1. **Lock por rutina compartida en cliente**
    - `RoutineService.syncSharedRoutinePayload` ahora serializa ejecuciones concurrentes por `sharedRoutineId`/`targetRoutineId`.
 2. **Deduplicación segura de `routine_days`**
    - En `DatabaseService.repairDataConsistency`, antes de borrar un `routine_day` duplicado se migran sus `routine_exercises` al `keeper` y se encola sync de esos updates.
 3. **Validación/defer en backend sync push para `routine_exercises -> routine_days`**
    - `website/app/api/sync/push/route.ts` ahora difiere si el padre `routine_day` viene en el mismo batch, y rechaza el upsert si el padre no existe.
    - Helper nuevo: `shouldDeferRoutineExerciseUpsert`.
- Validación:
 	- `jest src/services/__tests__/SyncService.test.ts` ✅ `17/17`.
 	- `vitest src/lib/sync-push-defer.test.ts` ✅ `6/6`.
 	- Producción Neon: FK `routine_exercises_routine_day_id_fk` creada en modo `NOT VALID` (enforced para nuevas escrituras, sin romper por legacy huérfanos).
 	- Migración versionada: `website/drizzle/0011_routine_exercises_fk_guard.sql`.

### Evidencia de ejecución (2026-04-01 · cierre de integridad remota)

- Saneamiento remoto ejecutado con estrategia reversible:
 	- Tabla de cuarentena creada: `public.routine_exercises_orphan_quarantine`.
 	- Filas huérfanas respaldadas en cuarentena: `96`.
 	- Filas huérfanas eliminadas de `public.routine_exercises`: `96`.
 	- Huérfanos remanentes post-saneamiento: `0`.
- FK validada en producción:
 	- `ALTER TABLE public.routine_exercises VALIDATE CONSTRAINT routine_exercises_routine_day_id_fk` ejecutado con éxito.
 	- Estado final: `convalidated=true`.
- Resultado final:
 	- Integridad referencial completa en remoto para `routine_exercises -> routine_days`.
 	- El incidente queda cerrado a nivel datos + código + enforcement DB.

### Evidencia de ejecución (2026-04-01 · investigación profunda de conteos inflados)

- Síntoma reportado por usuario (modal de conflicto/snapshot):
 	- `routine_days` en rango esperado (`11`) pero `routine_exercises` en nube muy superior (`227`).
- Forense en producción (Mateo):
 	- `routine_exercises` activos: `227`.
 	- De esos, `160` apuntaban a `routine_days` con `deleted_at IS NOT NULL` (padre soft-deleted).
 	- No hubo cruce de ownership (`cross_owner_rows = 0`).
- Causa raíz confirmada:
 	- El `DELETE` de `routine_days` en `sync/push` hacía soft-delete del día pero no hacía soft-delete cascada de `routine_exercises` hijos.
 	- `sync/status` y `sync/snapshot` contaban/exportaban `routine_exercises` por `user_id` sin filtrar por estado activo del padre.
- Parches aplicados:
 1. `website/app/api/sync/push/route.ts`
    - Al borrar `routine_days`, ahora hace soft-delete cascada de `routine_exercises` hijos del mismo usuario.
    - `routine_exercises` upsert ahora valida padre `routine_day` activo (`deletedAt IS NULL`) y del mismo usuario.
 2. `website/app/api/sync/status/route.ts`
    - Conteo de `routine_exercises` ahora exige padre `routine_day` existente, del usuario y activo.
 3. `website/app/api/sync/snapshot/route.ts`
    - Snapshot devuelve solo `routine_days` activos y `routine_exercises` activos cuyo padre está activo.
 4. `website/app/api/sync/pull/route.ts`
    - Pull ignora `routine_exercises` cuyos padres estén borrados o fuera de ownership.
 5. `src/services/SyncService.ts`
    - Diagnóstico local (`checkLocalStatus`) alinea conteo de `routine_exercises` con integridad de padre activo.
- Saneamiento remoto adicional (reversible):
 	- Tabla creada: `public.routine_exercises_stale_parent_quarantine`.
 	- Filas respaldadas: `160`.
 	- Filas soft-deleted: `160`.
 	- Remanente de `routine_exercises` activos con padre borrado: `0`.

### Evidencia de ejecución (2026-04-01 · hardening social T4.1-T4.4)

- Concurrencia por workspace endurecida y centralizada:
 	- Nuevo helper backend: `website/src/lib/shared-routine-lock.ts`.
 	- Endpoints migrados a lock unificado por `workspaceId`:
  		- `shared-routines/[id]/sync`
  		- `shared-routines/[id]/owner-sync`
  		- `shared-routines/[id]/rollback`
  		- `shared-routines/[id]/reviews/[reviewId]/decision`
- Métricas técnicas añadidas:
 	- Endpoint metrics (`recordEndpointMetric`) en los 4 endpoints críticos para `success/conflict/error` con eventos tipados (`revision_conflict`, `forbidden`, `internal_error`, etc.).
 	- Auto-sync de workspace en cliente con eventos:
  		- `shared_workspace_auto_sync_attempted`
  		- `shared_workspace_auto_sync_applied`
  		- `shared_workspace_auto_sync_skipped`
  		- `shared_workspace_auto_sync_error`
- Matriz de conflictos 409 ampliada (cliente):
 	- `src/services/__tests__/SocialService.test.ts` ahora cubre `sync`, `owner-sync`, `review decision` y `rollback` con payload `SHARED_ROUTINE_REVISION_CONFLICT`.
 	- Resultado validado: `9/9` tests en verde.
- Decomposición del modal de workspace (avance T4):
 	- Nuevo componente: `components/social/WorkspaceActionsSection.tsx`.
 	- `RoutineWorkspaceManagerModal` delega bloque de acciones activas (`sync`, `reviews`, `rollback`, comentarios) para bajar acoplamiento del archivo principal.
 	- Nuevo componente: `components/social/WorkspaceConfigSection.tsx`.
 	- `RoutineWorkspaceManagerModal` delega bloque de configuración (`members`, `invitations`, reglas de edición/aprobación y guardado).
- Pruebas HTTP de rutas `shared-routines` (backend):
 	- Archivo: `website/src/lib/social/shared-routines-route-http.test.ts`.
 	- Cobertura validada:
  		- `sync`: `401 unauthorized` + `409 revision conflict` + lock + endpoint metrics.
  		- `owner-sync`: `401 unauthorized` + `409 revision conflict` + lock + endpoint metrics.
  		- `review decision`: `401 unauthorized` + `409 revision conflict` + lock + endpoint metrics.
  		- `rollback`: `404 workspace not found` + `409 revision conflict` + lock + endpoint metrics.
 	- Resultado: `8/8` tests en verde con Vitest.

### Evidencia de ejecución (2026-04-01 · hardening social T5: deprecación controlada de aliases)

- Retiro controlado iniciado sin ruptura (modo transición 1 release):
 	- Wrappers alias con warning runtime one-shot en DEV:
  		- `src/hooks/useSharedSpaceSummary.ts`
  		- `src/social/sharedSpaceCopy.ts`
  		- `src/social/sharedSpaceFeedback.ts`
  		- `components/social/RoutineSharedSpaceManagerModal.tsx`
- Migración de consumidores activos a módulos canónicos (`workspace/*`):
 	- `components/LoadRoutineModal.tsx`
 	- `components/RoutineDetailModal.tsx`
 	- `app/(tabs)/exercises.tsx`
 	- `app/(tabs)/social.tsx`
 	- `components/social/RoutineWorkspaceManagerModal.tsx` (import canónico con alias local)
- Verificación paranoica de imports:
 	- Búsqueda global de imports a `useSharedSpaceSummary`, `sharedSpaceCopy`, `sharedSpaceFeedback`, `RoutineSharedSpaceManagerModal` -> `0` coincidencias fuera de wrappers deprecados.
- Validación ejecutada:
 	- `npm run test -- src/lib/social/shared-routines-route-http.test.ts` -> `8/8` ✅
 	- `npm run test -- src/services/__tests__/SocialService.test.ts` -> `9/9` ✅

### Evidencia de ejecución (2026-04-01 · hardening social T6: retiro definitivo de aliases)

- Alias wrappers eliminados del repositorio:
 	- `src/hooks/useSharedSpaceSummary.ts`
 	- `src/social/sharedSpaceCopy.ts`
 	- `src/social/sharedSpaceFeedback.ts`
 	- `components/social/RoutineSharedSpaceManagerModal.tsx`
 	- `components/social/SharedSpaceHubModal.tsx`
- Consumidores restantes migrados a componente canónico:
 	- `app/(tabs)/social.tsx` -> `SharedWorkspaceHubModal`
 	- `app/(tabs)/exercises.tsx` -> `SharedWorkspaceHubModal`
- Verificación paranoica post-retiro:
 	- Búsqueda global de imports a wrappers alias -> `0` coincidencias.
- Smoke de validación:
 	- `npm run test -- src/lib/social/shared-routines-route-http.test.ts` ✅
 	- `npm run test -- src/services/__tests__/SocialService.test.ts` ✅

### Evidencia de ejecución (2026-04-01 · hardening social T7: normalización final de naming workspace)

- Normalización en código activo (sin cambiar UX):
  - `app/(tabs)/social.tsx`: removidos aliases locales `useSharedSpaceSummary/sharedSpaceCopy/sharedSpaceFeedback/formatSharedSpaceStatus`.
  - `app/(tabs)/exercises.tsx`: removidos aliases locales equivalentes.
  - `components/social/SharedWorkspaceHubModal.tsx`: estado y helpers renombrados a `workspace*` (`workspaces`, `pendingByWorkspace`, `loadWorkspacePendingReviews`, etc.).
  - `src/hooks/useSharedWorkspaceSummary.ts`: estado interno renombrado a `workspaces` (sin impacto de contrato público).
  - `components/RoutineDetailModal.tsx` y `components/social/RoutineWorkspaceManagerModal.tsx`: nuevas keys canónicas (`workspaceTeamCoachmarkSeen`, `workspaceAutoSyncForEditors`) con fallback y escritura dual a keys legacy para transición segura.
- Verificación paranoica:
  - Imports a wrappers alias retirados: `0` coincidencias.
  - Referencias `sharedSpace*` restantes en app/components: solo keys legacy de compatibilidad (2 constantes), sin uso de módulos legacy.
- Validación:
  - TypeScript en archivos tocados: sin errores.
  - `npm run test -- src/lib/social/shared-routines-route-http.test.ts` -> `8/8` ✅
  - `npm run test -- src/services/__tests__/SocialService.test.ts` -> `9/9` ✅

## Plan de retiro de alias `sharedSpace/*`

- Fecha objetivo de freeze de aliases: 2026-04-15.
- Fecha objetivo de retiro definitivo: 2026-05-15.
- Checklist:
  - [x] Inventario de aliases activos documentado en este log.
  - [x] Crear wrappers deprecados con warning en runtime (1 release).
  - [x] Migrar imports internos a nombres canónicos `workspace/*`.
  - [x] Eliminar exports alias y actualizar referencias en docs.
  - [x] Validar smoke social/workspace antes de release final.
