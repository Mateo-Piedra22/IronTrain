# Distribución

## Documentos relacionados

- [Release](RELEASE.md)
- [Runbook operacional](RUNBOOK.md)
- [Troubleshooting](TROUBLESHOOTING.md)

## Android

- Pipeline oficial por GitHub Actions (`release-android.yml`).
- Build con EAS y publicación en GitHub Release.
- Integridad básica con archivo checksum `.sha256.txt`.

## Objetivo de distribución

- Entregar artefactos trazables y verificables.
- Separar canales de prueba y producción para reducir riesgo.
- Facilitar validación por QA o stakeholders antes de promoción amplia.

## Canales sugeridos

- Interno (QA/canary): tags de pruebas controladas.
- Producción: tags estables semver.

## Estrategia de promoción

1. Publicar en canal interno para validación inicial.
2. Confirmar criterios de calidad y ausencia de regresiones críticas.
3. Promover a canal de producción con tag semver estable.

## Requisitos de distribución

- Changelog generado.
- Tests/typecheck en verde.
- Secretos de build configurados en GitHub.

## Verificación post-publicación

- Descarga correcta del artefacto desde release.
- Checksum coincide con archivo publicado.
- Notas de release describen cambios y riesgos conocidos.
