# Runbook operacional

## Documentos relacionados

- [Arquitectura](ARCHITECTURE.md)
- [Seguridad y privacidad](SECURITY_PRIVACY.md)

## 1) Propósito

Este runbook define cómo diagnosticar, contener y recuperar incidentes operativos en IronTrain, con foco en:

- CI/CD.
- Releases Android.
- Sincronización social/rutinas compartidas.
- Seguridad.

## 2) Convenciones de respuesta

## 2.1 Severidad

- **SEV-1:** bloqueo total de release o fallo crítico de seguridad activa.
- **SEV-2:** falla funcional importante con workaround parcial.
- **SEV-3:** degradación menor sin impacto crítico inmediato.

## 2.2 Flujo de gestión

1. Detectar y clasificar severidad.
2. Contener para frenar propagación.
3. Identificar causa raíz.
4. Aplicar fix mínimo seguro.
5. Validar y cerrar con post-mortem breve.

## 3) Incidente: fallas de CI

## 3.1 Síntomas

- PR bloqueadas por checks rojos.
- Jobs de `ci.yml` o `security.yml` fallando de forma repetida.

## 3.2 Diagnóstico rápido

1. Identificar job exacto y step fallido.
2. Verificar si es falla determinística o intermitente.
3. Reproducir localmente con el mismo comando del workflow.

Comandos frecuentes:

```bash
npm test -- --watch=false
npx tsc --noEmit
cd website && npm run build
```

## 3.3 Contención

- Evitar mergear mientras el check requerido esté inestable.
- Si es falla externa/transitoria, re-run controlado y documentado.

## 3.4 Recuperación

- Aplicar fix puntual en la causa raíz.
- Re-ejecutar pipeline completo.
- Documentar en PR qué falló y cómo se corrigió.

## 4) Incidente: fallas de release Android

## 4.1 Síntomas

- `release-android.yml` falla en preflight/build/publicación.

## 4.2 Diagnóstico por etapas

1. **Tag:** validar `vMAJOR.MINOR.PATCH`.
2. **Secretos:** validar `EXPO_TOKEN` y credenciales asociadas.
3. **Preflight:** tests/typecheck.
4. **Build EAS:** revisar output JSON y artefactos.
5. **Release upload:** revisar permisos `contents: write`.

## 4.3 Contención

- No forzar nuevos tags hasta cerrar causa raíz.
- Si hubo artefacto parcial, invalidar comunicación de release hasta confirmación.

## 4.4 Recuperación

- Corregir problema específico.
- Re-lanzar por `workflow_dispatch` o nuevo tag controlado.
- Validar APK + checksum antes de anunciar release.

## 5) Incidente: sincronización social / workspaces

## 5.1 Síntomas

- Import/sync no aplica cambios.
- Conflictos de revisión (HTTP 409).
- Duplicación inesperada de rutinas.

## 5.2 Diagnóstico rápido

1. Confirmar si el problema es local, remoto o de contrato.
2. Revisar `shared_routine_links` y snapshot/revision aplicada.
3. Verificar estrategia usada (baseRevision/force/manual decision).

## 5.3 Contención

- Evitar operaciones destructivas en cascada.
- Pedir recarga de estado y reintento con revisión actualizada.

## 5.4 Recuperación

- Resolver conflicto con ruta explícita (aprobación/forzado/rollback según rol).
- Validar que rutina local quede enlazada correctamente.
- Confirmar ausencia de duplicados post-fix.

## 6) Incidente: seguridad

## 6.1 Síntomas

- Hallazgo CodeQL alto/crítico.
- Vulnerabilidad de dependencia en `npm audit`.
- Sospecha de secreto expuesto.

## 6.2 Diagnóstico y contención

1. Clasificar impacto y superficie afectada.
2. Si hay secreto expuesto: rotar inmediatamente.
3. Si es dependencia crítica: bloquear merge y preparar parche.

## 6.3 Recuperación

- Aplicar fix o update de dependencia.
- Revalidar `security.yml` completo.
- Documentar incidente y mitigación en PR + nota operativa.

## 7) Checklist de cierre de incidente

- [ ] Causa raíz identificada.
- [ ] Fix validado en entorno CI.
- [ ] Impacto y alcance documentados.
- [ ] Riesgo residual aceptado o mitigado.
- [ ] Acción preventiva definida (test, regla, guardrail o doc).

## 8) Post-mortem mínimo (plantilla)

- **Fecha/hora:**
- **Severidad:**
- **Síntoma observado:**
- **Causa raíz:**
- **Fix aplicado:**
- **Cómo prevenir repetición:**
- **Owner de seguimiento:**

## 9) Escalamiento recomendado

- Escalar a owner técnico cuando:
  - existe impacto en release productivo,
  - hay evidencia de riesgo de seguridad,
  - o no hay diagnóstico claro tras primer ciclo de contención.

## 10) Incidente: degradación Theme Marketplace (FASE 6)

### 10.1 Síntomas

- Aumento sostenido de latencia en `social/themes` o `admin/themes`.
- Incremento de errores 5xx en rutas de themes.
- Señal `ok=false` en `GET /api/admin/themes-health`.

### 10.2 Diagnóstico rápido

1. Consultar `GET /api/admin/themes-health` con usuario admin autorizado.
2. Revisar `report.failures` y `report.namespaces.*.breachingEndpoints`.
3. Confirmar thresholds activos por entorno:
  - `THEMES_SLO_MAX_ERROR_RATE`
  - `THEMES_SLO_MAX_P95_MS`
  - `THEMES_SLO_MAX_AVG_MS`
  - `THEMES_SLO_MIN_SAMPLES`

### 10.3 Contención

- Aplicar throttling operativo (ajuste rate limits de themes) si hay abuso.
- Pausar moderaciones masivas si el namespace `admin` aparece degradado.
- Priorizar estabilidad del endpoint `GET /api/social/themes` (feed/market).

### 10.4 Prueba de carga controlada

Ejecutar desde `website/`:

```bash
THEMES_LOAD_TOKEN=<token> npm run test:themes:load
```

Opcional para escenarios de instalación/interacción:

```bash
THEMES_LOAD_TOKEN=<token> THEMES_LOAD_THEME_ID=<theme-id> npm run test:themes:load
```

### 10.5 Rollback

1. Revertir último cambio en rutas `themes` y/o capa `theme-marketplace`.
2. Verificar recuperación de SLO con `GET /api/admin/themes-health`.
3. Confirmar auditoría admin de consulta/acción (`admin_audit_logs`).
4. Registrar post-mortem y acción preventiva.

## 11) Incidente: fallo de import/apply de themes en móvil

### 11.1 Síntomas

- Deep link `irontrain://share/theme/:slug` no abre flujo de importación.
- Import falla con `not_found`, `rate_limited`, `timeout` o `network_error` en secuencia.
- Se importa el theme pero no queda aplicable en Theme Studio.
- Métricas de install/apply no se mueven pese a uso real.

### 11.2 Diagnóstico rápido

1. Validar endpoint público con slug afectado: `GET /api/share/theme/:slug`.
2. Verificar estado del pack en DB (`visibility=public`, `status=approved`, `deleted_at IS NULL`).
3. Revisar salud API de themes con `GET /api/admin/themes-health`.
4. Confirmar en app que `themeMode`, `activeThemePackIdLight/Dark` y `themeDrafts` son coherentes.
5. Revisar cola local `theme_install_queue_v1` para detectar acumulación por fallos de red.

### 11.3 Contención

- Si hay abuso externo, endurecer rate limits de `share/theme` temporalmente.
- Si hay degradación backend, priorizar disponibilidad de lectura (`GET /api/share/theme/:slug`, `GET /api/social/themes`).
- Mantener apply local no bloqueante aunque falle tracking remoto de install.

### 11.4 Recuperación

1. Corregir disponibilidad del endpoint share y revalidar slug con request manual.
2. Ejecutar smoke tests de rutas themes en `website/`.
3. Validar en app import → draft persistido → apply (`light/dark/both`) en dispositivo real.
4. Confirmar drenado de cola de installs al restablecer conectividad.

### 11.5 Cierre

- Registrar timeline del incidente y causa raíz.
- Adjuntar evidencia de tests (app + website) y validación manual en iOS/Android.
- Crear acción preventiva (alerta, test o guardrail) antes de cerrar.

## 12) Incidente: degradación de colaboración en espacios compartidos

### 12.1 Síntomas

- Aumento de conflictos de sincronización por revisión.
- Caída de aceptación de invitaciones o backlog de invitaciones pendientes.
- Incremento sostenido de revisiones pendientes sin resolución.
- Equipos de 3+ miembros con fricción operativa recurrente.

### 12.2 Diagnóstico rápido

1. Consultar salud colaborativa: `GET /api/admin/workspace-collaboration/health`.
2. Consultar dashboard semanal: `GET /api/admin/workspace-collaboration/weekly?days=7`.
3. Verificar indicadores clave:
   - `report.windows.last7Days.activity.conflictCount`
   - `report.windows.last7Days.quality.conflictPer100Reviews`
   - `report.windows.last7Days.quality.invitationAcceptanceRatePct`
   - `report.adoption.pendingReviews`
   - `report.adoption.pendingInvitations`

### 12.3 Contención

- Si sube el conflicto: instruir actualización previa de revisión en equipos activos.
- Si crecen pendientes de revisión: priorizar revisión de owner en espacios con más miembros.
- Si cae aceptación de invitaciones: revisar copy operativo y roles propuestos por defecto.

### 12.4 Recuperación

1. Ejecutar seguimiento de 7 y 30 días con `workspace-collaboration/health`.
2. Priorizar espacios con conflicto alto y equipos de 3+ miembros.
3. Aplicar ajustes de rol/modo de aprobación en espacios con fricción repetida.
4. Revalidar métricas 24–48h después del ajuste.

### 12.5 Retención técnica (snapshots/changes)

- Política activa: [SHARED_ROUTINE_RETENTION_POLICY.md](SHARED_ROUTINE_RETENTION_POLICY.md).
- Cadencia:
  - Dry-run semanal (sin borrar).
  - Ejecución mensual controlada.
- Regla operativa: no ejecutar hard delete si existe incidente abierto de colaboración.

### 12.6 Cierre

- Registrar antes/después con evidencia de endpoints admin.
- Documentar causa raíz y ajuste aplicado (roles, aprobación, flujo operativo).
- Definir acción preventiva con owner y fecha (alerta, test o mejora de UX).
