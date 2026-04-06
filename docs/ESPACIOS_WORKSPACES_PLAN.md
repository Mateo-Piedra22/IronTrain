# Plan de mejora y robustecimiento del sistema de Espacios / Workspaces

Fecha: 2026-04-06
Estado: Plan completado (P0, P1, P2 y P3 completadas)

## Seguimiento de ejecución por fases

- P0 — Alineación de lenguaje y contrato UX: ✅ COMPLETADA
- P1 — Refactor de copy y UX contextual: ✅ COMPLETADA
- P2 — Hardening técnico de sync/review/invitaciones: ✅ COMPLETADA
- P3 — Optimización funcional y escalabilidad: ✅ COMPLETADA

## Objetivo

Mejorar claridad, confiabilidad y adopción del sistema colaborativo sin romper la base técnica existente.

## Principios del plan

1. **Primero claridad de producto (copy + modelo mental)**.
2. **Cambios incrementales y medibles** (sin reescritura total).
3. **Hardening sobre flujos críticos** (sync, review, rollback, invitaciones).
4. **Observabilidad orientada a decisiones de producto**.

---

## Fase 0 (1 semana): Alineación de lenguaje y contrato UX

### Entregables

- Glosario oficial de términos (usuario + técnico).
- Guía de copy para todo el módulo social/workspace.
- Matriz de estados/acciones por rol (`owner/editor/viewer`) y por modo (`owner_only/collaborative`, `none/owner_review`).

### Tareas ejecutables (granular)

- [x] 0.1 Definir término final de UI: **Espacio compartido**.
- [x] 0.2 Definir glosario unificado de términos usuario/técnico.
- [x] 0.3 Definir verbos de acción estándar de colaboración.
- [x] 0.4 Definir guía de copy base (tono, estructura, reglas).
- [x] 0.5 Definir matriz de estados/acciones por rol y modo.
- [x] 0.6 Registrar artefactos en el informe técnico.

### Trabajo concreto

- Definir término final para UI: **Espacio compartido**.
- Reemplazar en todo el front visible los términos ambiguos (`Workspace/Equipo`) por taxonomía unificada.
- Definir verbos de acción estándar:
  - “Publicar cambios”
  - “Actualizar desde el espacio”
  - “Solicitar revisión”
  - “Aprobar/Rechazar cambios”

### Criterios de aceptación

- 100% de pantallas/modales de colaboración usan misma taxonomía.
- Ningún texto mezcla 2+ términos para mismo concepto.
- Existe documento breve “Cómo funciona un Espacio compartido” enlazable desde UI.

### Impacto esperado

- Reducción inmediata de confusión de onboarding y soporte.

Estado Fase 0: ✅ COMPLETADA

---

## Fase 1 (1–2 semanas): Refactor de copy y UX contextual (prioridad máxima)

### Entregables

- Refactor de textos en:
  - `app/(tabs)/social.tsx`
  - `components/social/*`
  - `components/RoutineDetailModal.tsx`
  - `src/social/sharedWorkspaceCopy.ts`
- Estados vacíos y mensajes de error con lenguaje guiado a acción.
- Microcopy de confirmaciones/destructivos (rollback, remover miembro, cancelar invitación).

### Tareas ejecutables (granular)

- [x] 1.1 Definir patrón de mensaje por estado: “Estado actual / Qué significa / Acción recomendada”.
- [x] 1.2 Crear blueprint de reemplazo de términos ambiguos por términos oficiales.
- [x] 1.3 Crear catálogo base de microcopy para errores/confirmaciones críticas.
- [x] 1.4 Aplicar refactor de textos en `app/(tabs)/social.tsx`.
- [x] 1.5 Aplicar refactor de textos en `components/social/*`.
- [x] 1.6 Aplicar refactor de textos en `components/RoutineDetailModal.tsx`.
- [x] 1.7 Aplicar refactor de textos en `src/social/sharedWorkspaceCopy.ts`.
- [x] 1.8 Ejecutar QA manual de 5 flujos clave.

### Evidencia QA manual (1.8)

- [x] Flujo 1: Estado contextual en `app/(tabs)/social.tsx` validado con patrón “Estado actual / Qué significa / Acción recomendada”.
- [x] Flujo 2: Hub y modales de espacio (`SharedWorkspaceHubModal`, `WorkspaceHistoryModal`, `WorkspaceCommentsModal`, `WorkspaceReviewsModal`) validados con copy unificado “Espacio compartido”.
- [x] Flujo 3: Roles y acciones en `WorkspaceActionsSection.tsx` validados (propietario/editor/lector + acciones guiadas).
- [x] Flujo 4: Configuración de miembros en `WorkspaceConfigSection.tsx` validada (filtros/labels de rol consistentes y sin ambigüedad visible).
- [x] Flujo 5: Pruebas de servicio social ejecutadas (`src/services/__tests__/SocialService.test.ts`): 9/9 OK para sync, owner-sync, decisión de revisión y rollback.

### Trabajo concreto

- Introducir patrón visual de estado:
  - “Estado actual”
  - “Qué significa”
  - “Acción recomendada”.
- Simplificar párrafos largos en bullets cortos.
- Añadir ayudas contextuales en momentos críticos:
  - conflicto de revisión,
  - invitación pendiente,
  - modo de aprobación activo,
  - lector con auto-sync.

### Criterios de aceptación

- Pruebas manuales de 5 flujos clave completadas sin ambigüedad semántica.
- Feedback interno: usuarios nuevos entienden diferencias entre editar/publicar/proponer en <2 minutos.
- Reducción de errores de uso en QA exploratorio.

### Impacto esperado

- Alta mejora de comprensión y confianza del usuario.

Estado Fase 1: ✅ COMPLETADA

---

## Fase 2 (1–2 semanas): Hardening técnico de sync/review/invitaciones

### Entregables

- Guardrails adicionales en endpoints críticos.
- Idempotencia explícita en acciones sensibles donde aplique.
- Telemetría de conflicto y revisión con dashboard básico.

### Tareas ejecutables (granular)

- [x] 2.1 Estandarizar respuesta HTTP para conflicto de revisión.
- [x] 2.2 Estandarizar respuesta HTTP para permiso insuficiente.
- [x] 2.3 Estandarizar respuesta HTTP para recurso inexistente.
- [x] 2.4 Estandarizar respuesta HTTP para estado inválido review/invitación.
- [x] 2.5 Añadir guardrails idempotentes en rutas críticas (double-submit safe).
- [x] 2.6 Instrumentar eventos de negocio `workspace_*`.
- [x] 2.7 Publicar dashboard semanal de conflicto/revisión/invitación.

### Evidencia 2.7

- Endpoint admin semanal publicado: `GET /api/admin/workspace-collaboration/weekly?days=7`.
- Fuente de datos: agregador de eventos `workspace_*` conectado en `captureServerEvent`.
- Salida del reporte: serie diaria + totales semanales para conflicto/revisión/invitación (y rollback informativo).

### Trabajo concreto

- Validar y estandarizar respuestas de error para:
  - conflicto de revisión,
  - permiso insuficiente,
  - recurso inexistente,
  - estado inválido de review/invitación.
- Revisar rutas críticas:
  - `website/app/api/social/shared-routines/[id]/sync/route.ts`
  - `.../owner-sync/route.ts`
  - `.../reviews/[reviewId]/decision/route.ts`
  - `.../rollback/route.ts`
  - `.../invitations/[invitationId]/decision/route.ts`
- Añadir eventos de métricas de negocio:
  - `workspace_invitation_sent/accepted/rejected`
  - `workspace_sync_conflict`
  - `workspace_review_requested/approved/rejected`
  - `workspace_rollback_executed`.

### Criterios de aceptación

- Casos de doble submit no generan inconsistencias.
- Conflictos devuelven payload útil para resolución en UI.
- Dashboard interno muestra tasas semanales de conflicto/revisión/invitación.

### Impacto esperado

- Menos incidencias operativas y mejor trazabilidad.

Estado Fase 2: ✅ COMPLETADA

---

## Fase 3 (2–3 semanas): Optimización funcional y escalabilidad de colaboración

### Entregables

- Mejoras de experiencia multi-miembro.
- Política de retención/limpieza de historial técnico.
- Checklist de readiness para crecimiento.

### Tareas ejecutables (granular)

- [x] 3.1 Ajustar UX de miembros/invitaciones para equipos >2.
- [x] 3.2 Definir política de archivado de snapshots/changes.
- [x] 3.3 Integrar reportes periódicos de salud colaborativa.
- [x] 3.4 Actualizar runbook operativo para incidentes de colaboración.

### Evidencia Fase 3

- 3.1 UX >2 miembros: resumen de roles/invitaciones + guía contextual en `components/social/WorkspaceConfigSection.tsx`.
- 3.2 Política de archivado definida en `docs/SHARED_ROUTINE_RETENTION_POLICY.md` y contrato técnico en `website/src/lib/shared-routine-retention-policy.ts`.
- 3.3 Reporte periódico integrado:
  - `GET /api/admin/workspace-collaboration/health`
  - `GET /api/admin/workspace-collaboration/weekly?days=7`
  - Agregado en `website/src/lib/workspace-collaboration-health.ts`.
- 3.4 Runbook operativo actualizado con incidente de colaboración en `docs/RUNBOOK.md`.

### Trabajo concreto

- Revisar UX de miembros/invitaciones para equipos >2 personas.
- Definir política de archivado de snapshots/changes antiguos (sin perder auditoría necesaria).
- Añadir reportes periódicos de salud del módulo social (adopción, fricción, tiempo a aprobar).

### Criterios de aceptación

- Métricas muestran mejora sostenida en adopción y menor conflicto relativo.
- Operación documentada en runbook con procedimientos claros ante incidentes.

### Impacto esperado

- Colaboración más estable y escalable.

Estado Fase 3: ✅ COMPLETADA

---

## Backlog recomendado (post-fases)

1. Versionado semántico de cambios para reviews (tipo de cambio: estructura/carga/orden).
2. Notificaciones push/email para invitaciones y reviews pendientes.
3. Plantillas de espacios (casos de uso recurrentes).
4. Mejoras de accesibilidad en modales densos de información.

---

## Priorización impacto/esfuerzo

- **P1 (alto impacto / bajo-medio esfuerzo):** Fase 0 + Fase 1 (copy, taxonomía, estados UI).
- **P2 (alto impacto / medio esfuerzo):** Hardening Fase 2.
- **P3 (medio-alto impacto / medio-alto esfuerzo):** Fase 3 y backlog de crecimiento.

---

## Responsables sugeridos

- Producto/UX Writing: Fase 0–1 (lidera taxonomía y microcopy).
- Frontend móvil: implementación UI/copy y estados contextuales.
- Backend: hardening de endpoints, idempotencia, telemetría técnica.
- QA: casos E2E de colaboración y regresión por rol/modo.
- Data/Producto: definición y lectura semanal de KPIs.

---

## KPIs de éxito del plan

1. +X% de activación de espacios compartidos (7 y 30 días).
2. -X% de conflictos por 100 sincronizaciones.
3. -X% de tiempo medio para resolver reviews.
4. +X% de invitaciones aceptadas.
5. -X% de incidencias/consultas de soporte por confusión de uso.

---

## Riesgos del plan y mitigación

- Riesgo: “solo cambiar texto” sin ajustar flujo real.
  - Mitigación: cada cambio de copy debe enlazar a acción concreta y estado visible.
- Riesgo: mejorar UX pero sin medición.
  - Mitigación: instrumentar métricas antes/después desde Fase 2.
- Riesgo: regresiones en sync/review.
  - Mitigación: suite de pruebas por rol/mode + smoke tests de endpoints críticos.

---

## Definición de Done global

El plan se considera completado cuando:

- El lenguaje del módulo es consistente y entendible para usuarios nuevos.
- Los flujos críticos presentan estado claro + acción recomendada.
- La operación dispone de métricas y runbook actualizado.
- Se confirma mejora de adopción y reducción de fricción con datos.
