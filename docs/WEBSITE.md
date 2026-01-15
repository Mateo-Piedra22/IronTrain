# Website (Vercel) – irontrain.motiona.xyz

## Objetivo
Landing + Descargas + Changelog + FAQ + Donaciones, y un endpoint estable para updates de la app:
- `https://irontrain.motiona.xyz/releases.json`

## Estructura
- Web: `website/` (Next.js App Router)
- Changelog fuente: `docs/CHANGELOG.md`
- Descargas fuente: `docs/DOWNLOADS.json`

La web lee ambos archivos desde el repositorio en build/runtime (sin dependencias externas).

## Deploy en Vercel
1. Importa el repo en Vercel.
2. Configura **Root Directory**: `website`
3. Build Command: `npm run build`
4. Output: automático (Next.js)
5. Dominio: `irontrain.motiona.xyz`
6. Asegúrate de dejar **Output Directory vacío** en Project Settings (si está en `public`, falla).

## Integración opcional con GitHub Releases (recomendado)
La web puede obtener automáticamente el APK desde el **último GitHub Release** si configuras variables de entorno en Vercel:
- `GITHUB_RELEASES_OWNER` (ej. `motiona`)
- `GITHUB_RELEASES_REPO` (ej. `irontrain`)
- `GITHUB_RELEASES_TOKEN` (opcional: aumenta rate limit; usar token de solo lectura)

Si no se configuran, la web usa `docs/DOWNLOADS.json`.

## CI/CD recomendado (build + release automático)
Para automatizar “tag → build APK → GitHub Release”, usa GitHub Actions:
- Workflow: `.github/workflows/release-android.yml`
- Trigger: push de tag `v*`
- Requiere: secret `EXPO_TOKEN` en GitHub

## Actualizaciones automáticas
- Cambios en `docs/CHANGELOG.md` y `docs/DOWNLOADS.json` se reflejan automáticamente con cada deploy (push a git).
- Para que la app detecte updates, apunta `extra.updateFeedUrl` a:
  - `https://irontrain.motiona.xyz/releases.json`

## Publicar una nueva versión
1. Actualiza `app.json` (versión) y `docs/CHANGELOG.md` (release cerrado con fecha).
2. Sube el APK y pega la URL en `docs/DOWNLOADS.json` (latest.apk.url) + checksum (opcional).
3. Push a git → Vercel redeploy automático.
