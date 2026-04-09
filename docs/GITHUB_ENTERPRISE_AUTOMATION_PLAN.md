# IronTrain — Plan Enterprise de GitHub (Workflows, Jobs, Runners y Bots)

> Fecha base: 2026-04-09  
> Objetivo: llevar el repositorio a un estándar **Enterprise** de CI/CD, seguridad, gobernanza y trazabilidad, con una lista operativa para ejecutar y marcar progreso.

---

## 1) Resumen ejecutivo

- Estado actual detectado:
  - Workflows: **4**
  - Jobs: **7**
  - Runners: **1 tipo** (`ubuntu-latest`)
  - Bot principal: **Dependabot** (con auto-merge para patch/minor)
- Meta Enterprise recomendada:
  - Workflows: **12** (agregar **8**)
  - Jobs: **24** aprox. (agregar **17**)
  - Runners: **4 clases** (agregar **3**)
  - Bots/apps: agregar **4** (o **3** si se mantiene Dependabot y no se usa Renovate)

---

## 2) Inventario actual (baseline)

### Workflows actuales

- [x] `.github/workflows/ci.yml`
  - Jobs:
    - [x] `mobile-quality`
    - [x] `web-quality`
    - [x] `dependency-review`

- [x] `.github/workflows/security.yml`
  - Jobs:
    - [x] `codeql`
    - [x] `npm-audit`

- [x] `.github/workflows/release-android.yml`
  - Jobs:
    - [x] `build-and-release`

- [x] `.github/workflows/dependabot-auto-merge.yml`
  - Jobs:
    - [x] `automerge`

### Configuración detectada

- [x] `.github/dependabot.yml`
- [x] `.github/pull_request_template.md`
- [x] `CODEOWNERS`
- [x] `SECURITY.md`
- [x] Issue forms (`.github/ISSUE_TEMPLATE/*`)
- [x] Configuración formal de labels/triage como código

---

## 3) Principios Enterprise a cumplir

Marcar cuando estén implementados de forma verificable:

- [ ] **Seguridad por defecto**: permisos mínimos (`permissions`) en todos los workflows.
- [ ] **Supply chain hardening**: pin de versiones críticas, scans de secretos, SBOM, licencias, provenance.
- [ ] **Governance**: dueños de código (`CODEOWNERS`), branch protection, required checks, ambientes con aprobación.
- [ ] **Trazabilidad**: releases reproducibles, artifacts firmados/atados a commit/tag.
- [ ] **Observabilidad CI**: métricas de duración/fallas por job, flakes y MTTR.
- [ ] **Costo/eficiencia**: cache correcta, cancelación por concurrencia, runners apropiados por carga.

---

## 4) Arquitectura objetivo (target)

## 4.1 Workflows objetivo (12 total)

### Mantener (4 existentes)

- [ ] `ci.yml`
- [ ] `security.yml`
- [ ] `release-android.yml`
- [ ] `dependabot-auto-merge.yml` *(si se mantiene Dependabot; se retira si migran a Renovate)*

### Agregar (8 nuevos)

1. [x] `pr-governance.yml`
2. [x] `actionlint-workflows.yml`
3. [x] `secrets-scan.yml`
4. [x] `sast-semgrep.yml`
5. [x] `sbom-license.yml`
6. [x] `release-provenance.yml`
7. [x] `android-promote.yml`
8. [x] `repo-hygiene.yml`

## 4.2 Runners objetivo (4 clases)

- [x] `ubuntu-22.04` (pinneado para estabilidad)
- [ ] `ubuntu-latest` (solo donde convenga actualización automática)
- [ ] `macos-latest` (smoke iOS / validación mínima Apple stack)
- [ ] `self-hosted` pool aislado para signing/release crítico (opcional fase 2/3)

## 4.3 Bots / Apps objetivo

- [ ] Dependabot **o** Renovate (definir uno como estándar)
- [x] Codecov (cobertura y quality gate)
- [ ] Allstar / policy-bot (hardening de repo org-level)
- [x] Stale/Triage bot (higiene operativa de issues/PR)

---

## 5) Backlog ejecutable por fases (lista para correr)

> Recomendación: ejecutar en orden. Cada fase tiene Definition of Done (DoD).

## Fase 0 — Gobierno base (rápida, alto impacto)

### Tareas

- [x] Crear `CODEOWNERS`
  - Pasos:
    - [x] Definir owners por rutas (`app/`, `components/`, `website/`, `.github/`, `scripts/`)
    - [x] Exigir review de owner en branch protection
  - DoD:
    - [x] PR de prueba exige review de owner automáticamente

- [x] Crear `SECURITY.md`
  - Pasos:
    - [x] Política de reporte de vulnerabilidades
    - [x] SLA de respuesta (ej. 24h ack / 7 días evaluación)
  - DoD:
    - [x] Visible en pestaña Security del repo

- [x] Configurar Branch Protection en rama por defecto (`master`)
  - Pasos:
    - [x] Requerir checks obligatorios (CI + Security)
    - [x] Requerir approvals mínimas (2 recomendado)
    - [x] Bloquear force-push y deletion
    - [x] Activar linear history (opcional)
  - DoD:
    - [x] No se puede mergear sin checks y approvals

- [x] Definir Environments GitHub (`staging`, `production`)
  - Pasos:
    - [x] Secrets por ambiente
    - [x] Required reviewers para `production`
  - DoD:
    - [x] Deploy/release a production pide aprobación humana

### Comandos útiles

- [x] Verificar owners y archivos críticos
  - `git ls-files .github docs app website | measure`

### Evidencia Fase 0 (2026-04-09)

- [x] Archivo creado: `.github/CODEOWNERS`
- [x] Archivo creado: `SECURITY.md`
- [x] Branch protection aplicada en rama por defecto (`master`) con:
  - checks requeridos: `Mobile Quality Checks`, `Web Build Checks`, `CodeQL Analysis`, `NPM Audit (prod deps)`
  - `require_code_owner_reviews: true`
  - `required_approving_review_count: 2`
  - `required_linear_history: true`
  - `allow_force_pushes: false`, `allow_deletions: false`
- [x] Environments configurados por API: `staging`, `production`
- [x] `production` con required reviewer configurado

---

## Fase 1 — Hardening de CI y workflows

### 1.1 Workflow: `pr-governance.yml`

- [x] Crear workflow para PR quality gates:
  - [x] Conventional PR title check
  - [x] Tamaño PR (alerta/bloqueo por cambios masivos)
  - [x] Commit lint (si aplica)
  - [x] Labeler automático por rutas
- [x] Marcar checks como required en branch protection
- DoD:
  - [x] Ninguna PR entra sin estándares mínimos

### 1.2 Workflow: `actionlint-workflows.yml`

- [x] Lint de todos los YAML en `.github/workflows`
- [x] Fallar PR si hay errores de sintaxis o malas prácticas
- DoD:
  - [x] Errores de workflows detectados antes de merge

### 1.3 Endurecer workflows existentes

- [x] Revisar `permissions:` en cada workflow/job (mínimo privilegio)
- [x] Pinear acciones de terceros críticas a SHA cuando aplique
- [x] Revisar `concurrency` para evitar builds duplicados innecesarios
- [x] Agregar `timeout-minutes` consistente por job
- DoD:
  - [x] Auditoría de permisos completada y documentada

### Evidencia de implementación (2026-04-09)

- [x] Workflow creado: `.github/workflows/pr-governance.yml`
- [x] Workflow creado: `.github/workflows/actionlint-workflows.yml`
- [x] Configuración de labeler creada: `.github/labeler.yml`
- [x] Labels creados en GitHub: `mobile`, `web`, `ci-cd`, `security`, `release`, `docs`
- [x] Required checks actualizados en branch protection (`master`) incluyendo:
  - `PR Title (Conventional)`
  - `PR Size Guard`
  - `PR Commit Convention`
  - `PR Auto Labeler`
  - `Workflow Lint (actionlint)`
- [x] Hardening aplicado en workflows existentes:
  - runners estables `ubuntu-22.04` en CI/Security/Dependabot/Release
  - permisos por job de mínimo privilegio
  - pinning SHA en acciones críticas de terceros (`expo`, `softprops`, `dependabot`, `hmarr`, `peter-evans`)

---

## Fase 2 — Seguridad avanzada (AppSec + Supply Chain)

### 2.1 Workflow: `secrets-scan.yml`

- [x] Integrar Gitleaks (o equivalente)
- [x] Ejecutar en PR + push + schedule
- [x] Configurar baseline para evitar ruido inicial
- DoD:
  - [x] Secret scanning bloquea merges con leaks reales

### 2.2 Workflow: `sast-semgrep.yml`

- [x] Ejecutar Semgrep en reglas relevantes JS/TS
- [x] Subir resultados a SARIF / Security tab
- [x] Definir severidad bloqueante (`high/critical`)
- DoD:
  - [x] Hallazgos críticos rompen CI en PR

### 2.3 Workflow: `sbom-license.yml`

- [x] Generar SBOM (CycloneDX) para root y `website/`
- [x] Ejecutar policy de licencias (denylist/allowlist)
- [x] Publicar artifact SBOM por build
- DoD:
  - [x] Cada release tiene SBOM disponible y política de licencias aplicada

### 2.4 Mejoras a `security.yml`

- [x] Revisar schedule de CodeQL (mínimo semanal)
- [x] Ajustar `npm audit` para evitar falsos positivos bloqueantes en prod-only strategy
- [x] Definir flujo de excepción temporal (waivers con vencimiento)
- DoD:
  - [x] Seguridad consistente, sin ruido operativo excesivo

### Evidencia Fase 2 (2026-04-09)

- [x] Workflow creado: `.github/workflows/secrets-scan.yml`
- [x] Workflow creado: `.github/workflows/sast-semgrep.yml`
- [x] Workflow creado: `.github/workflows/sbom-license.yml`
- [x] Políticas creadas:
  - `.github/security/npm-audit-waivers.json` (waivers temporales con expiración)
  - `.github/security/license-policy.json` (denylist + excepciones)
- [x] `security.yml` mejorado con auditoría JSON + validación de waivers por expiración/razón
- [x] Required checks actualizados en branch protection (`master`) incluyendo:
  - `Secrets Scan (Gitleaks)`
  - `SAST (Semgrep)`
  - `SBOM and License Compliance`

---

## Fase 3 — Releases Enterprise Android

### 3.1 Workflow: `release-provenance.yml`

- [x] Emitir attestations/provenance del artifact de release
- [x] Atar artifact a commit SHA y tag semver
- [x] Guardar metadatos de build (fecha, runner, hash)
- DoD:
  - [x] Cada artifact tiene trazabilidad verificable

### 3.2 Workflow: `android-promote.yml`

- [x] Separar build de promoción (staging -> production)
- [x] Requerir aprobación manual para promotion a production
- [x] Validar changelog/version/tag de forma estricta
- DoD:
  - [x] Flujo de release controlado por ambientes, no directo

### 3.3 Runners para release

- [x] Definir si release queda en GitHub-hosted o pasa a self-hosted aislado
- [x] Decisión actual: GitHub-hosted (`ubuntu-22.04`) con hardening en workflows + environments (self-hosted queda como evolución futura)
- [x] Si self-hosted (N/A en esta fase):
  - [x] Runner group dedicado (N/A)
  - [x] Acceso restringido solo a workflows de release (N/A)
  - [x] Hardening de host y rotación de credenciales (N/A)
- DoD:
  - [x] Riesgo operativo de secrets/signing significativamente reducido

### Evidencia Fase 3 (2026-04-09)

- [x] Workflow creado: `.github/workflows/release-provenance.yml`
- [x] Workflow creado: `.github/workflows/android-promote.yml`
- [x] `release-android.yml` ajustado para build en `staging` con release draft/prerelease
- [x] Activos de release ampliados: APK + SHA256 + `build-metadata-<tag>.json`
- [x] Provenance implementado con:
  - validación de semver tag
  - validación de checksum APK
  - reporte `release-provenance-<tag>.json` adjunto al release
  - artifact attestation (`actions/attest-build-provenance`)
- [x] Promoción a producción implementada con `environment: production` (requiere aprobación manual configurada)

---

## Fase 4 — Operación continua y productividad

### 4.1 Workflow: `repo-hygiene.yml`

- [x] Auto-label por paths
- [x] Stale issue/PR policy (con tiempos claros)
- [x] Triage automático de issues nuevas
- DoD:
  - [x] Backlog limpio y mantenible sin trabajo manual excesivo

### 4.2 Cobertura y calidad

- [x] Integrar Codecov
- [x] Definir threshold de cobertura por paquete (`root` / `website`)
- [x] Bloquear regresión de cobertura relevante
- DoD:
  - [x] Cobertura visible en PR y gate activo

### 4.3 Métricas de plataforma

- [x] Dashboard CI: duración, fail rate, flakes, tiempo a merge
- [x] Revisiones quincenales de métricas
- [x] Plan de mejora continua por trimestre
- DoD:
  - [x] Tendencia medible de mejora (menos fallas, menos tiempo)

### Evidencia Fase 4 (2026-04-09)

- [x] Workflow creado: `.github/workflows/repo-hygiene.yml`
- [x] Workflow creado: `.github/workflows/coverage-quality.yml`
- [x] Workflow creado: `.github/workflows/engineering-metrics.yml`
- [x] Integración de cobertura:
  - `codecov.yml` agregado con status por `project` y `patch`
  - gate local por umbrales + regresión en `.github/quality/coverage-thresholds.json`
  - upload de cobertura por flags (`mobile`, `web`) + artifacts de evidencia
- [x] Issue forms y triage como código:
  - `.github/ISSUE_TEMPLATE/config.yml`
  - `.github/ISSUE_TEMPLATE/bug_report.yml`
  - `.github/ISSUE_TEMPLATE/feature_request.yml`
- [x] Runbook de métricas y cadencia quincenal/trimestral: `docs/CI_METRICS_RUNBOOK.md`
- [x] Labels de hygiene/triage estandarizados en GitHub: `triage`, `needs-info`, `stale`, `closed-by-bot`
- [x] Required checks actualizados en branch protection (`master`) incluyendo:
  - `Coverage Quality Gate`
  - `Repo Hygiene - PR Path Labels`

---

## 6) Plantilla de tarea operativa (copiar/pegar por item)

Usar esta mini-plantilla en cada issue técnica:

- [ ] **Nombre de tarea**
- [ ] **Owner**
- [ ] **Fecha compromiso**
- [ ] **Dependencias**
- [ ] **Implementación**
  - [ ] Paso 1
  - [ ] Paso 2
  - [ ] Paso 3
- [ ] **Validación**
  - [ ] Evidencia en PR
  - [ ] Evidencia en logs/checks
- [ ] **Rollback**
  - [ ] Cómo desactivar/revertir
- [ ] **DoD** cumplido

---

## 7) Matriz de priorización (impacto vs esfuerzo)

### Alta prioridad (hacer primero)

- [x] `CODEOWNERS` + branch protection
- [x] `SECURITY.md`
- [x] `actionlint-workflows.yml`
- [x] `secrets-scan.yml`
- [x] `pr-governance.yml`

### Prioridad media

- [x] `sast-semgrep.yml`
- [x] `sbom-license.yml`
- [x] Codecov
- [x] Environments con approvals estrictos

### Prioridad avanzada

- [x] `release-provenance.yml`
- [x] `android-promote.yml`
- [x] Self-hosted runner aislado para release (decisión actual: N/A, se mantiene GitHub-hosted endurecido)
- [ ] Allstar/policy-bot org-level

---

## 8) Riesgos y mitigaciones

- [ ] Riesgo: exceso de falsos positivos en seguridad
  - Mitigación:
    - [ ] Baseline inicial
    - [ ] Reglas por severidad
    - [ ] Waivers con expiración

- [ ] Riesgo: fricción por demasiados required checks
  - Mitigación:
    - [ ] Introducción gradual por fase
    - [ ] Medir tiempos de PR

- [ ] Riesgo: costos de runner/build
  - Mitigación:
    - [ ] Cache optimizada
    - [ ] Concurrency/cancel in progress
    - [ ] Ajuste de matrix/runners por tipo de job

---

## 9) Criterios de éxito globales (KPI)

Marcar cuando alcancen objetivo por al menos 2 sprints:

- [ ] 0 merges a `main` sin checks requeridos
- [ ] 0 secretos expuestos en historial nuevo
- [ ] 100% de releases con artifact hash + provenance/SBOM
- [ ] < 10% de fallas por causas no determinísticas (flakes)
- [ ] Reducción de tiempo promedio de PR a merge (meta interna)

---

## 10) Secuencia recomendada (orden exacto de ejecución)

1. [x] Fase 0 completa
2. [x] Fase 1 completa
3. [x] Fase 2 completa
4. [x] Fase 3 completa
5. [x] Fase 4 completa
6. [ ] Revisar KPI y re-plan trimestral

---

## 11) Entregables esperados al finalizar

- [ ] 12 workflows activos y estables
- [ ] 24 jobs aprox. distribuidos por dominio
- [ ] 4 clases de runners con uso justificado
- [ ] Bot stack operativo (dependencias, cobertura, policy, hygiene)
- [ ] Documentación y runbook de incidentes CI/CD en `docs/`

---

## 12) Registro de avance

### Sprint / Semana 1

- [ ] Tareas completadas:
- [ ] Bloqueos:
- [ ] Decisiones tomadas:

### Sprint / Semana 2

- [ ] Tareas completadas:
- [ ] Bloqueos:
- [ ] Decisiones tomadas:

### Sprint / Semana 3

- [ ] Tareas completadas:
- [ ] Bloqueos:
- [ ] Decisiones tomadas:

---

## 13) Nota de implementación

Este plan está diseñado para ejecución incremental sin romper la operación actual. Si una fase introduce fricción inesperada, pausar en el hito anterior y estabilizar antes de continuar.
