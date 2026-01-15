# Comandos (Enterprise) – App y Website

Este documento lista **comandos oficiales** para desarrollo, QA y producción.

---

# App

## Instalación
- `npm install`

## Desarrollo
- `npm start` (dev + watcher CHANGELOG)
- `npm run android`
- `npm run ios`
- `npm run web`
- `npx expo start -c` (limpiar cache Metro)
- `npx expo-doctor` (diagnóstico Expo)

## Calidad
- `npm test`
- `npm run generate-changelog`
- `npx tsc -p tsconfig.json --noEmit`

## Releases
- Preparar versión: `npm run release:prepare -- <x.y.z>`
- Finalizar (poner fecha + crear siguiente Unreleased): `npm run release:finalize`

## EAS (builds)
- Login: `npx eas login`
- Usuario actual: `npx eas whoami`
- Build APK (distribución directa): `npx eas build --platform android --profile preview --wait`
- Build AAB (Play Store): `npx eas build --platform android --profile production --wait`

---

# Website

## Instalación
Desde `website/`:
- `npm install`

## Desarrollo
- `npm run dev`
- Puerto alternativo: `npx next dev -p 3005`

## Producción
- `npm run build`
- `npm run start`

## Deploy (Vercel)
- Root Directory: `website`
- Build: `npm run build`

Variables env recomendadas (Vercel):
- `GITHUB_RELEASES_OWNER`
- `GITHUB_RELEASES_REPO`
- `GITHUB_RELEASES_TOKEN` (opcional)

---

# GitHub Releases (APK)

## Manual
1. Crear tag `vX.Y.Z`
2. Crear release con ese tag
3. Subir asset `.apk`

## GitHub CLI (si disponible)
- `gh release create vX.Y.Z ./ruta/IronTrain-vX.Y.Z.apk --title "IronTrain vX.Y.Z" --notes "Release vX.Y.Z"`

## CI/CD (recomendado)
- Trigger: `git tag vX.Y.Z && git push --tags`
- Workflow: `.github/workflows/release-android.yml`
- Secret requerido: `EXPO_TOKEN`
