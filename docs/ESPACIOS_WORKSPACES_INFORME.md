# Informe integral del sistema de Espacios / Workspaces (dispositivo + website)

## 1) Resumen ejecutivo

El sistema de colaboración de rutinas compartidas está **bien avanzado a nivel técnico** (modelo de datos, permisos por rol, revisión de cambios, control de concurrencia, historial y rollback), con una arquitectura coherente entre móvil y backend website.

El principal cuello de botella actual no es de capacidad técnica, sino de **claridad de producto/UX**: la terminología y el copy (`Workspace`, `Espacio`, `Equipo`, `rutina compartida`) mezclan conceptos y generan fricción para entender qué es, para qué sirve y cómo se usa en colaboración real.

Conclusión: la base es sólida para escalar, pero conviene ejecutar una fase corta de **clarificación semántica + ajustes de flujo + hardening incremental** para reducir errores operativos y aumentar adopción.

---

## 2) Alcance analizado

### Dispositivo (app)

- Entradas y hub social: `app/(tabs)/social.tsx`.
- Gestión operativa del workspace: `components/social/SharedWorkspaceHubModal.tsx`, `RoutineWorkspaceManagerModal.tsx`, `WorkspaceConfigSection.tsx`, `WorkspaceActionsSection.tsx`, `WorkspaceReviewsModal.tsx`.
- Contexto desde rutina: `components/RoutineDetailModal.tsx`.
- Contrato API cliente: `src/services/SocialService.ts`.
- Sincronización local + enlace remoto/local: `src/services/RoutineService.ts`, `src/services/DatabaseService.ts` (`shared_routine_links`).
- Copy y feedback/haptics: `src/social/sharedWorkspaceCopy.ts`, `src/social/workspaceFeedback.ts`, `src/social/feedback.ts`.

### Website (backend + API)

- Esquema colaborativo: `website/src/db/schema.ts`.
- Políticas de edición/revisión/revisión de versión: `website/src/lib/shared-routine-sync-policy.ts`.
- Concurrencia por workspace (advisory lock): `website/src/lib/shared-routine-lock.ts`.
- Endpoints sociales: `website/app/api/social/shared-routines/**` (route principal, sync, owner-sync, rollback, reviews, decision, comments, changes, invitations).

### Operación/documentación

- `docs/ARCHITECTURE.md`, `docs/RUNBOOK.md`, `docs/TROUBLESHOOTING.md`, `docs/SOCIAL_HARDENING_LOG.md`.

---

## 3) Estado de implementación por capas

## 3.1 Modelo de datos (DB)

El dominio está correctamente normalizado para colaboración:

- `shared_routines`: entidad raíz del espacio compartido.
- `shared_routine_members`: membresía, rol y permisos efectivos.
- `shared_routine_invitations`: invitaciones y su ciclo de estado.
- `shared_routine_snapshots`: versionado por revisión.
- `shared_routine_changes`: bitácora de cambios y metadatos de sync.
- `shared_routine_review_requests`: flujo de aprobación cuando `approvalMode=owner_review`.
- `shared_routine_comments`: conversación contextual.

Valoración: **fuerte**. Hay soporte para auditoría, restauración y trazabilidad.

## 3.2 Backend (API website)

Capacidades cubiertas end-to-end:

- Alta/listado/detalle de espacios compartidos.
- Invitación y decisión de invitaciones.
- Sync colaborativo con control de revisión (`baseRevision` vs `serverRevision`) y respuesta de conflicto.
- Modo con revisión de owner (cola de review + decisión aprobar/rechazar).
- Owner sync y rollback a revisiones anteriores.
- Historial y comentarios.
- Lock transaccional por workspace para serializar mutaciones concurrentes.

Valoración: **robusto para MVP+**.

## 3.3 Frontend móvil

El flujo funcional existe y está segmentado por modal/secciones. Se observan:

- Estado de workspace visible desde tab social y desde detalle de rutina.
- Acciones de configuración y operación razonablemente completas.
- Soporte de feedback (toast/haptics) centralizado.

Debilidad principal:

- **Semántica y copy fragmentados**: aparecen términos distintos para un mismo concepto y textos largos con lógica interna no evidente para usuario final.

## 3.4 Integración local-first

Fortalezas:

- Enlace explícito `shared_routine_id` ↔ `local_routine_id`.
- Mecanismos para evitar sincronizaciones solapadas.
- Aplicación de snapshots con seguimiento de revisión.

Riesgo residual:

- Dependencia de buena visibilidad del estado de sincronización y de manejo claro de conflictos para evitar acciones repetidas o “force sync” innecesario.

---

## 4) Fortalezas detectadas

1. **Arquitectura de colaboración completa** (no solo CRUD): incluye revisión, historial, rollback y comentarios.
2. **Control de concurrencia real** con lock de workspace.
3. **Modelo de permisos flexible** (`owner/editor/viewer`, `owner_only/collaborative`, `none/owner_review`).
4. **Estrategia de versionado clara** mediante snapshots + revisiones.
5. **Punto de extensión sano** para métricas y hardening operativo.

---

## 5) Problemas y oportunidades (hallazgos críticos)

## 5.1 Claridad conceptual y copy (CRÍTICO)

Problema:

- Se alternan `Workspace`, `Espacio`, `Equipo` y “rutina compartida” sin una taxonomía explícita.
- El usuario no siempre entiende la diferencia entre:
  - compartir una rutina,
  - pertenecer a un espacio,
  - editar directamente,
  - proponer cambios para aprobación,
  - sincronizar su copia local.

Impacto:

- Mayor tasa de error operativo (especialmente en invitaciones, revisión y sync).
- Curva de aprendizaje innecesaria.
- Fricción para colaboración de 2+ personas.

## 5.2 Fricción en flujos de estado

Problema:

- Estados importantes (pendiente de revisión, conflicto de revisión, necesidad de refrescar snapshot local) no siempre se entienden rápido sin leer texto largo.

Impacto:

- Menor confianza en el sistema.
- Riesgo de acciones “forzadas” incorrectas.

## 5.3 Riesgos de evolución

- Con crecimiento de usuarios/equipos, la ausencia de un lenguaje uniforme y microcopy contextual puede convertirse en principal factor de soporte/incidencias.
- El backend está preparado para más volumen lógico; la UX actual podría quedar como cuello de botella de adopción.

---

## 6) Diagnóstico de terminología (propuesta base)

Recomendación: fijar un **glosario único** y aplicarlo en toda la app.

Propuesta:

- **Espacio compartido** (término principal visible para usuario).
- **Rutina base del espacio** (objeto colaborativo).
- **Miembros** (owner/editor/lector).
- **Modo de edición**: “Solo propietario” vs “Colaborativa”.
- **Modo de aprobación**: “Sin revisión” vs “Revisión del propietario”.
- **Publicar cambios** (en vez de sync ambiguo).
- **Actualizar desde el espacio** (en vez de pull/sync técnico).

Regla:

- Mantener “workspace” solo en código/documentación técnica interna, no en copy de UI final.

---

## 7) Riesgo técnico por dominio

- **DB:** bajo-medio (estructura sólida; vigilar crecimiento de snapshots/changes).
- **Backend:** medio (bien diseñado; endurecer idempotencia y observabilidad por endpoint crítico).
- **Frontend móvil:** medio-alto por UX semántica y visibilidad de estados.
- **Operación:** medio (ya hay runbook, pero falta instrumentación orientada a producto: adopción, rechazo de invitaciones, conflict rate por workspace).

---

## 8) Recomendaciones priorizadas (alto nivel)

1. **Refactor total de copy y taxonomía** (prioridad máxima).
2. **Rediseño ligero de estado/acciones por contexto** (mostrar “qué pasa ahora” + “siguiente acción recomendada”).
3. **Hardening de sync/review** (idempotencia, telemetría de conflicto, guardrails de acciones destructivas).
4. **KPIs de colaboración** para medir adopción real y cuellos de botella.

---

## 9) Métricas sugeridas para validar mejora

- Activación: % usuarios que crean o se unen a un espacio.
- Colaboración: % espacios con 2+ miembros activos en 7/30 días.
- Flujo invitaciones: aceptación/rechazo/expiración.
- Fricción de sync: tasa de conflictos por 100 syncs.
- Revisión: tiempo medio de aprobación/rechazo.
- Claridad UX: reducción de eventos de error y tickets de soporte relacionados a “no entiendo cómo funciona”.

---

## 10) Conclusión

La implementación actual permite colaboración real y tiene una base técnica madura para evolucionar. El siguiente salto de calidad no depende de rehacer arquitectura, sino de **hacer comprensible y predecible la experiencia**: lenguaje único, flujos más explícitos y telemetría orientada a decisiones de producto.

---

## 11) Entregables ejecutados — Fase 0 (completada)

### 11.1 Glosario oficial (usuario + técnico)

- **Espacio compartido (UI):** contenedor de colaboración sobre una rutina común.
- **Workspace (técnico):** término interno en código/DB/API para `shared_routines`.
- **Rutina base del espacio:** versión compartida y versionada de la rutina.
- **Miembros:** personas que participan del espacio (roles owner/editor/viewer).
- **Publicar cambios:** enviar una nueva versión al espacio.
- **Actualizar desde el espacio:** traer la última versión del espacio a la copia local.
- **Solicitud de revisión:** propuesta pendiente cuando el modo requiere aprobación del owner.

Regla de oro:
- En UI se usa **“Espacio compartido”**; “workspace” queda solo para contexto técnico.

### 11.2 Guía de copy base (módulo social/workspaces)

Tono y estructura:
- Oraciones cortas, orientadas a acción.
- Priorizar voz directa: “Publica cambios”, “Actualiza”, “Revisa”.
- Evitar jerga técnica (`sync`, `pull`, `force`) en texto visible.

Formato recomendado por bloque:
1. **Estado actual:** qué pasa ahora.
2. **Qué significa:** consecuencia práctica para el usuario.
3. **Acción recomendada:** siguiente paso único y claro.

Ejemplos:
- Antes: “Conflicto de revisión detectado.”
- Después: “**Estado actual:** tu versión quedó desactualizada. **Qué significa:** alguien publicó cambios antes. **Acción recomendada:** pulsa ‘Actualizar desde el espacio’ y vuelve a publicar.”

- Antes: “Viewer auto-sync enabled.”
- Después: “**Estado actual:** estás en modo lector. **Qué significa:** no puedes editar esta rutina compartida. **Acción recomendada:** pide rol editor al propietario si necesitas proponer cambios.”

### 11.3 Matriz de estados/acciones por rol y modo

#### Modo de edición: `owner_only`
- Owner:
  - Publicar cambios: Sí
  - Aprobar/rechazar revisiones: Sí (si aplica)
  - Invitar/gestionar miembros: Sí
- Editor:
  - Publicar directo: No
  - Solicitar revisión: Sí (si `approvalMode=owner_review`)
  - Comentarios: Sí
- Viewer:
  - Editar/publicar: No
  - Actualizar desde el espacio: Sí
  - Comentarios: Sí

#### Modo de edición: `collaborative`
- Owner:
  - Publicar cambios: Sí
  - Aprobar/rechazar revisiones: Sí (si aplica)
  - Invitar/gestionar miembros: Sí
- Editor:
  - Publicar directo: Sí cuando `approvalMode=none`
  - Solicitar revisión: Sí cuando `approvalMode=owner_review`
  - Comentarios: Sí
- Viewer:
  - Editar/publicar: No
  - Actualizar desde el espacio: Sí
  - Comentarios: Sí

#### Modo de aprobación: `owner_review`
- Cambios de no-owner quedan en estado pendiente hasta decisión del owner.
- UI debe mostrar “Pendiente de revisión” + CTA “Ver estado de revisión”.

#### Modo de aprobación: `none`
- Publicaciones válidas se aplican directamente, respetando permisos por rol/modo de edición.

Estado Fase 0: ✅ COMPLETADA

---

## 12) Entregables preparados — Fase 1 (en progreso)

### 12.1 Blueprint de reemplazo terminológico (para aplicar en UI)

- “Workspace” -> “Espacio compartido”
- “Equipo” (cuando representa entidad) -> “Espacio compartido”
- “Sync” -> “Publicar cambios” (push) / “Actualizar desde el espacio” (pull)
- “Owner review” -> “Revisión del propietario”
- “Viewer” -> “Lector” (copy de usuario final)

### 12.2 Catálogo base de microcopy crítico

Errores:
- Permiso insuficiente: “No tienes permiso para esta acción en este espacio.”
- Recurso no encontrado: “Este espacio ya no está disponible o fue eliminado.”
- Conflicto de revisión: “Tu versión está desactualizada. Actualiza y vuelve a intentar.”

Confirmaciones/destructivos:
- Rollback: “Vas a restaurar una versión anterior del espacio. Esta acción crea una nueva revisión.”
- Remover miembro: “Esta persona perderá acceso al espacio compartido.”
- Cancelar invitación: “La invitación dejará de estar disponible para aceptar.”

### 12.3 Estado de ejecución Fase 1

- Diseño de copy y estructura contextual: ✅ COMPLETADO
- Aplicación en código (`social.tsx`, `components/social/*`, `RoutineDetailModal.tsx`, `sharedWorkspaceCopy.ts`): ⏳ PENDIENTE
- QA manual de 5 flujos clave: ⏳ PENDIENTE

Estado Fase 1: 🟡 EN PROGRESO
