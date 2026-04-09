# Release

## Documentos relacionados

- [CI/CD](CI_CD.md)
- [Distribución](DISTRIBUTION.md)
- [Runbook operacional](RUNBOOK.md)

## Flujo estándar Android

1. Preparar versión y changelog.
2. Ejecutar `npm run deploy:mobile` (commit/tag/push automático).
3. Dejar que `release-android.yml` ejecute build en `staging` y cree release `draft/prerelease`.
4. Verificar artefactos (`.apk`, `.sha256.txt`, `build-metadata-*.json`).
5. Dejar que `release-provenance.yml` adjunte evidencia de trazabilidad/attestation.
6. Ejecutar manualmente `android-promote.yml` para promover a `production` (con aprobación de environment).

## Alcance del proceso

- Este flujo cubre build, trazabilidad y promoción controlada a producción.
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

- Release final publicada (no draft/no prerelease).
- APK publicada en GitHub Release.
- Archivo checksum generado.
- Metadata y provenance adjuntos al release.

## Criterios de release saludable

- Jobs de release/provenance/promotion sin fallas ni pasos omitidos.
- Artefactos descargables y checksum verificable.
- Metadatos de versión coherentes (tag, notas, changelog).

## Rollback y contingencia

1. Pausar distribución de la versión defectuosa.
2. Etiquetar incidente y registrar causa probable.
3. Publicar patch release con tag nuevo semver.
4. Documentar post-mortem corto con acción preventiva.
