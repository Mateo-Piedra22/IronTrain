# CI/CD (Enterprise) – Android APK + GitHub Releases + Vercel

## Objetivo
Con un tag `vX.Y.Z`, generar un APK (EAS), publicar un GitHub Release con assets y dejar la web lista para servir:
- Descarga APK
- Feed de updates `/releases.json`

## Componentes
- GitHub Actions: `.github/workflows/release-android.yml`
- Expo/EAS: `eas.json` (perfil `preview` genera `apk`)
- Website (Vercel): obtiene el APK desde GitHub Releases si tiene env vars

## Requisitos (GitHub)
### Secrets
- `EXPO_TOKEN`: token de Expo con permiso para ejecutar `eas build`
  - Crear token: Expo Dashboard → Settings → Access Tokens

## Requisitos (Vercel)
### Environment Variables
- `GITHUB_RELEASES_OWNER`
- `GITHUB_RELEASES_REPO`
- `GITHUB_RELEASES_TOKEN` (opcional, recomendado)

## Flujo recomendado (operación)
1. Preparar versión:
   - `npm run release:prepare -- 1.2.0`
2. Cambios + tests:
   - `npm test`
3. Finalizar changelog:
   - `npm run release:finalize`
4. Crear tag y push:
   - Tag: `v1.2.0`
5. GitHub Actions construye y publica Release con:
   - `IronTrain-v1.2.0.apk`
   - `IronTrain-v1.2.0.sha256.txt`
6. Vercel sirve automáticamente:
   - `/downloads`
   - `/releases.json`

## Notas operativas
- Las env vars de Vercel **no** construyen APK. Solo consumen releases ya publicados.
- El pipeline de GitHub es el que automatiza build + release.
