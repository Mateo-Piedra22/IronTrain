# Release

## Documentos relacionados

- [CI/CD](CI_CD.md)
- [Distribución](DISTRIBUTION.md)
- [Runbook operacional](RUNBOOK.md)

## Flujo estándar Android

1. Preparar versión y changelog.
2. Crear tag semver `vX.Y.Z`.
3. Dejar que `release-android.yml` ejecute build y publicación.

## Alcance del proceso

- Este flujo cubre la publicación de artefactos Android por pipeline automatizado.
- El release debe ser reproducible, auditable y acompañado por evidencia mínima de calidad.

## Preflight mínimo

- `npm test -- --watch=false`
- `npx tsc --noEmit`
- Validar secretos de GitHub Actions.

## Checklist recomendado antes de tag

- Changelog revisado y consistente con cambios reales.
- CI + Security en verde en `main`.
- Riesgos conocidos documentados con mitigación.
- Validación manual breve de flujos críticos si hubo cambios sensibles.

## Resultado esperado

- APK publicada en GitHub Release.
- Archivo checksum generado.

## Criterios de release saludable

- Job de release sin fallas ni pasos omitidos.
- Artefactos descargables y checksum verificable.
- Metadatos de versión coherentes (tag, notas, changelog).

## Rollback y contingencia

1. Pausar distribución de la versión defectuosa.
2. Etiquetar incidente y registrar causa probable.
3. Publicar patch release con tag nuevo semver.
4. Documentar post-mortem corto con acción preventiva.
