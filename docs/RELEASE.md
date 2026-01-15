# Release (Android)

## Perfil de build
El repo incluye `eas.json` con perfiles:
- `preview`: genera APK (internal distribution).
- `production`: genera App Bundle.

## Build APK (preview)
Requiere EAS CLI configurado y autenticación de Expo.

```bash
npx eas build -p android --profile preview
```

## Notas
- Mantener `npm test` verde antes de buildear.
- Evitar cambios de schema sin migración idempotente.

