# DevOps y guardrails

## Documentos relacionados

- [CI/CD](CI_CD.md)
- [Seguridad y privacidad](SECURITY_PRIVACY.md)
- [Runbook operacional](RUNBOOK.md)

## Automatización aplicada

- CI unificado en `ci.yml`.
- Security pipeline en `security.yml`.
- Release Android endurecido en `release-android.yml`.
- Dependabot para npm root, website y GitHub Actions.
- PR template para uniformar validación.

## Objetivo de los guardrails

- Prevenir degradaciones silenciosas antes de llegar a `main`.
- Reducir riesgo de seguridad por cambios de código o supply chain.
- Asegurar trazabilidad mínima de decisiones técnicas en PR/release.

## Guardrails clave

- Permisos mínimos en workflows.
- Concurrency para evitar carreras entre ejecuciones.
- Timeouts explícitos para jobs críticos.
- Validaciones de typecheck/tests/build antes de release.

## Guardrails recomendados adicionales

- Mantener workflows simples y con pasos explícitos.
- Evitar secretos innecesarios en jobs que no los requieren.
- Versionar acciones y revisar periódicamente su vigencia.
- Exigir evidencia de validación para PR de riesgo medio/alto.

## Acciones manuales necesarias

- Branch protection en `main`.
- Required checks configurados en GitHub.
- Activar Dependabot alerts y secret scanning según plan.

## Modelo de ownership sugerido

- Owner de CI: disponibilidad y estabilidad de `ci.yml`.
- Owner de seguridad: triage de findings y políticas de remediación.
- Owner de release: salud de `release-android.yml` y trazabilidad de artefactos.

## Revisión periódica (mensual)

1. Revisar tiempos de ejecución y puntos de flakiness.
2. Confirmar que required checks siguen alineados al riesgo real.
3. Auditar permisos de workflows y uso de secretos.
4. Verificar estado de actualizaciones pendientes (Dependabot y actions).
