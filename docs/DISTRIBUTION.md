# Distribución (Enterprise) – Android sin Play Store

## Qué hacen (y qué NO hacen) las env vars de Vercel
Configurar env vars en Vercel **NO construye** la APK automáticamente.

Lo que sí hace:
- Permite que la web lea el **último GitHub Release** (tag + assets) y use el asset `.apk` como link de descarga.
- Hace que `/releases.json` apunte a ese APK y la app pueda decir “Actualización disponible”.

Lo que no hace:
- No ejecuta builds de Expo/EAS.
- No crea releases en GitHub.

## Flujo recomendado (manual pero profesional)
1. Preparar versión:
   - `npm run release:prepare -- 1.2.0`
2. Implementar cambios y correr calidad:
   - `npm test`
3. Finalizar changelog (poner fecha):
   - `npm run release:finalize`
4. Generar APK (EAS recomendado):
   - `npx eas build --platform android`
5. Publicar en GitHub Releases:
   - Tag: `v1.2.0`
   - Asset: `IronTrain-v1.2.0.apk`
6. Push a git:
   - Vercel redeploy → `irontrain.motiona.xyz` se actualiza solo
   - La app detecta update vía `https://irontrain.motiona.xyz/releases.json`

## Flujo 100% automático (CI/CD)
Si quieres que “hago push/tag y se construye + publica solo”, se implementa un pipeline en GitHub Actions:
- Trigger: push de tag `v*`
- Pasos:
  1) instalar deps
  2) autenticar Expo/EAS (EXPO_TOKEN)
  3) correr `eas build`
  4) descargar artifact
  5) crear GitHub Release y subir `.apk`

Requisitos típicos (secrets en GitHub):
- `EXPO_TOKEN` (token de Expo con permiso para EAS build)

## Nota sobre “build a Expo”
“Subir una nueva build a Expo” crea un build en EAS, pero eso por sí solo no actualiza tu web
si la web está tomando APK desde GitHub Releases. Para automatizarlo, el pipeline debe publicar también el asset al Release.

