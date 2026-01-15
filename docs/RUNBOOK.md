# Runbook (Enterprise) – IronTrain

Este documento define el flujo operativo estándar para mantener **App** y **Website** en producción.

## Principios
- Una sola fuente de verdad para el changelog: `docs/CHANGELOG.md`.
- La web se despliega en Vercel y se actualiza por push a git.
- La app detecta updates vía `https://irontrain.motiona.xyz/releases.json`.

---

# App (IronTrain)

## Comandos (dev)
- Instalar dependencias: `npm install`
- Levantar (watch changelog + expo): `npm start`
- Levantar Android: `npm run android`
- Levantar iOS: `npm run ios`
- Levantar web: `npm run web`
- Reiniciar Metro (limpiar cache): `npx expo start -c`
- Doctor (salud del proyecto): `npx expo-doctor`

## Comandos (calidad)
- Tests: `npm test`
- Generar changelog JSON (app): `npm run generate-changelog`
- TypeScript (diagnóstico editor/CI): `npx tsc -p tsconfig.json --noEmit`

## Gestión de versión y changelog (release)
### Preparar una nueva versión
Actualiza versión de app + package y asegura sección Unreleased:
- `npm run release:prepare -- 1.2.0`

Esto:
- actualiza `app.json` y `package.json` a `1.2.0`
- asegura `## 1.2.0 (Unreleased)` en `docs/CHANGELOG.md`
- regenera `src/changelog.generated.json`

### Cerrar una versión (publicar)
Cuando ya está lista y vas a distribuir un build:
- `npm run release:finalize`

Esto:
- convierte `## <version> (Unreleased)` en `## <version> (YYYY-MM-DD)`
- crea automáticamente el siguiente patch `Unreleased` (ej. `1.2.1 (Unreleased)`)
- regenera `src/changelog.generated.json`

## Distribución sin Play Store (recomendado)
Flujo pro sin tienda:
1. Cierra el release: `npm run release:finalize`
2. Genera el APK/AAB (según tu flujo Expo/EAS).
3. Publica el APK en GitHub Releases (o storage estable).
4. La web toma automáticamente el APK desde GitHub Releases (si está configurado en Vercel), o desde `docs/DOWNLOADS.json`.

### Comandos EAS (Android)
- Login: `npx eas login`
- Usuario actual: `npx eas whoami`
- Build APK interno (recomendado para distribución directa): `npx eas build --platform android --profile preview --wait`
- Build AAB (solo si vas a Play Store): `npx eas build --platform android --profile production --wait`

### Flujo 100% automático (CI/CD)
Trigger recomendado: push de tag `vX.Y.Z`. El pipeline:
- corre `eas build` (preview APK)
- descarga el `.apk` desde EAS
- crea un GitHub Release y sube assets

Documento: `docs/DISTRIBUTION.md` y workflow: `.github/workflows/release-android.yml`.

---

# Website (irontrain.motiona.xyz)

## Comandos (dev / prod)
Desde `website/`:
- Instalar dependencias: `npm install`
- Dev: `npm run dev`
- Build producción: `npm run build`
- Start producción local: `npm run start`

## Fuentes de datos
- Changelog: `docs/CHANGELOG.md`
- Descargas (fallback): `docs/DOWNLOADS.json`
- Descargas (recomendado): GitHub Releases vía env vars en Vercel

## Endpoint de updates para la app
- Feed: `/releases.json`
- Producción: `https://irontrain.motiona.xyz/releases.json`

El feed:
- Nunca promueve “Unreleased” como release estable.
- Solo incluye `downloadUrl` si existe un APK para esa versión.

## Deploy (Vercel)
1. Importa repo en Vercel.
2. Root Directory: `website`
3. Conecta dominio: `irontrain.motiona.xyz`
4. Variables de entorno (opcional pero recomendado):
   - `GITHUB_RELEASES_OWNER`
   - `GITHUB_RELEASES_REPO`
   - `GITHUB_RELEASES_TOKEN` (opcional)

## Vendor / Branding
- Empresa desarrolladora: MotionA
- Sitio oficial: https://motiona.xyz

---

# GitHub Releases (publicación del APK)

## Estándar de tags y assets
- Tag recomendado: `vX.Y.Z` (ej. `v1.2.0`)
- Asset recomendado:
  - `IronTrain-v1.2.0.apk`
  - opcional: `IronTrain-v1.2.0.sha256.txt`

## Publicar (manual)
- Crea un release en GitHub con el tag `vX.Y.Z`.
- Sube el APK como asset del release.
- La web detecta el último release y usa su APK.

## Publicar (con GitHub CLI, si la tienes instalada)
Ejemplo:
- `gh release create v1.2.0 ./path/IronTrain-v1.2.0.apk --title "IronTrain v1.2.0" --notes-file docs/CHANGELOG.md`

Ajusta el archivo de notas si quieres un extracto en lugar de todo el changelog.
