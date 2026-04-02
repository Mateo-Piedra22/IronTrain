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

## Responsabilidad de cada workflow

- `ci.yml`: protege calidad funcional/técnica previa al merge.
- `security.yml`: reduce riesgo de vulnerabilidades en código y dependencias.
- `release-android.yml`: publica artefactos Android de forma repetible y auditable.

## Objetivo del flujo

- Bloquear merges con calidad insuficiente.
- Detectar riesgo de dependencia/código temprano.
- Estandarizar release Android reproducible.

## Triggers recomendados

- Pull request a `main`: ejecutar CI + Security.
- Push a `main`: confirmar estabilidad en rama protegida.
- Tag semver: disparar release Android.

## Recomendaciones GitHub Settings

- Branch protection para `main`.
- Required checks: CI + Security.
- Require PR review y resolución de conversaciones.

## Configuración de branch protection (mínima)

- Requerir checks antes de merge.
- Bloquear bypass para colaboradores estándar.
- Requerir branch actualizada antes de merge cuando el riesgo lo justifique.

## Convención de release Android

- Tags: `vMAJOR.MINOR.PATCH`.
- El workflow valida formato antes de construir.

## Política de fallback ante fallas de pipeline

1. Identificar job/step exacto.
2. Confirmar si es falla determinística o transitoria.
3. Aplicar fix mínimo y reproducible.
4. Re-ejecutar pipeline completo.
5. Documentar causa raíz en PR/incidente.
