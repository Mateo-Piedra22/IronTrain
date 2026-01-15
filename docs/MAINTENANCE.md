# Mantenimiento (Enterprise) – Qué actualizar y dónde

## App

### Versión
- Fuente: `app.json` → `expo.version`
- Sincronización: `package.json` → `version`
- Comando estándar (actualiza ambas + crea sección Unreleased + regenera JSON):
  - `npm run release:prepare -- <x.y.z>`

### Changelog
- Fuente única: `docs/CHANGELOG.md`
- Reglas:
  - La sección `Unreleased` siempre va arriba.
  - Solo “cierra” la versión cuando existe un build distribuible.
- Comando estándar para cerrar (pone fecha + crea siguiente Unreleased):
  - `npm run release:finalize`

### Feed de actualizaciones (app)
- URL del feed: `app.json` → `expo.extra.updateFeedUrl`
- Recomendado (producción): `https://irontrain.motiona.xyz/releases.json`

---

## Website

### Contenido
- Changelog: se genera desde `docs/CHANGELOG.md` automáticamente.
- Descargas:
  - Modo recomendado: GitHub Releases (no se edita nada al publicar un release).
  - Modo fallback: `docs/DOWNLOADS.json`

### Variables de entorno (Vercel)
Para auto-descargas desde GitHub Releases:
- `GITHUB_RELEASES_OWNER`
- `GITHUB_RELEASES_REPO`
- `GITHUB_RELEASES_TOKEN` (opcional)

---

## Publicación sin tienda (flujo recomendado)
1. `npm run release:prepare -- <x.y.z>`
2. Implementar cambios, tests: `npm test`
3. Cerrar changelog: `npm run release:finalize`
4. Generar build (EAS/Expo según tu setup)
5. Crear GitHub Release `vX.Y.Z` y subir el APK como asset
6. Push a git → Vercel actualiza web automáticamente

