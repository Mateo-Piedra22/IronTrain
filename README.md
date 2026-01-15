# IronTrain

IronTrain es una app de entrenamiento Local-First (sin cuentas) enfocada en fuerza. Los datos se guardan en SQLite en el dispositivo y se pueden exportar/importar.

## Funcionalidades clave
- Diario de entrenamiento con sets (peso/reps/RPE), warmups y sets completados.
- Rest timer con mini-overlay y auto-inicio al completar una serie (configurable).
- Analíticas: volumen, consistencia, tendencias y 1RM estimado.
- Librería: categorías, ejercicios, historial por ejercicio, herramientas (placas/1RM).
- Backups: export/import en JSON.

## Stack
- React Native (Expo SDK 54)
- Navegación: expo-router
- DB: expo-sqlite
- Estado: Zustand
- UI: NativeWind
- Charts: react-native-gifted-charts

## Documentación
- [Arquitectura](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/docs/ARCHITECTURE.md)
- [Desarrollo](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/docs/DEVELOPMENT.md)
- [DB y migraciones](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/docs/DATABASE.md)
- [Unidades, timers y estados](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/docs/UNITS_TIMERS_WORKOUT_STATUS.md)
- [Testing](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/docs/TESTING.md)
- [Release (Android)](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/docs/RELEASE.md)
- [Seguridad y privacidad](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/docs/SECURITY_PRIVACY.md)
- [Changelog](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/docs/CHANGELOG.md)

## Comandos
```bash
npm install
npm test
npx expo start
```
