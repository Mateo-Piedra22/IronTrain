# CI/CD

## Documentos relacionados

- [DevOps y guardrails](DEVOPS_GUARDRAILS.md)
- [Testing](TESTING.md)
- [Release](RELEASE.md)
- [Runbook operacional](RUNBOOK.md)

## Pipelines activos

- `ci.yml`: calidad mobile + build/typecheck web + dependency review.
- `security.yml`: CodeQL + npm audit (root y website).
- `release-android.yml`: release Android por tag semver o trigger manual.
- `pr-governance.yml`: reglas de título/commits/tamaño de PR + labels por paths.
- `actionlint-workflows.yml`: lint de workflows GitHub Actions.
- `secrets-scan.yml`: detección de secretos (Gitleaks).
- `sast-semgrep.yml`: análisis SAST (Semgrep) y SARIF.
- `sbom-license.yml`: SBOM + cumplimiento de licencias.
- `coverage-quality.yml`: umbrales/regresión de cobertura + upload a Codecov.
- `repo-hygiene.yml`: labels de PR, triage de issues y política stale.
- `release-provenance.yml`: evidencia de trazabilidad y attestation de release.
- `android-promote.yml`: promoción manual de release a producción.
- `engineering-metrics.yml`: métricas quincenales de CI/PR.

## Responsabilidad de cada workflow

- `ci.yml`: protege calidad funcional/técnica previa al merge.
- `security.yml`: reduce riesgo de vulnerabilidades en código y dependencias.
- `release-android.yml`: genera build Android en `staging` y release `draft/prerelease`.
- `release-provenance.yml`: valida checksum y adjunta trazabilidad de artefactos.
- `android-promote.yml`: controla el paso final a producción con aprobación manual.

## Objetivo del flujo

- Bloquear merges con calidad insuficiente.
- Detectar riesgo de dependencia/código temprano.
- Estandarizar release Android reproducible con promoción controlada a producción.

## Triggers recomendados

- Pull request a `main`: ejecutar CI + Security.
- Push a `main`: confirmar estabilidad en rama protegida.
- Tag semver: disparar release Android.
- Workflow dispatch: promoción manual a producción (`android-promote.yml`).

## Recomendaciones GitHub Settings

- Branch protection para `main`.
- Required checks: CI + governance + security + coverage + hygiene.
- Require PR review y resolución de conversaciones.
- CODEOWNERS habilitado y code owner review obligatorio.
- Environment `production` con required reviewers.

## Configuración de branch protection (mínima)

- Requerir checks antes de merge.
- Bloquear bypass para colaboradores estándar.
- Requerir branch actualizada antes de merge cuando el riesgo lo justifique.

## Convención de release Android

- Tags: `vMAJOR.MINOR.PATCH`.
- El workflow valida formato antes de construir.
- `deploy:mobile` dispara el pipeline de build/provenance.
- La publicación final a producción requiere promoción manual.

## Política de fallback ante fallas de pipeline

1. Identificar job/step exacto.
2. Confirmar si es falla determinística o transitoria.
3. Aplicar fix mínimo y reproducible.
4. Re-ejecutar pipeline completo.
5. Documentar causa raíz en PR/incidente.
