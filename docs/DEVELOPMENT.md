# Desarrollo

## Requisitos
- Node.js + npm
- Expo CLI (vía `npx expo`)

## Instalar y ejecutar
```bash
npm install
npx expo start
```

## Estilos
- Se usa NativeWind con la paleta de `Colors` en [theme.ts](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/src/theme.ts).
- Nota: el “900” del theme es fondo claro; el “950” es texto oscuro.

## Estructura de rutas
- La app usa expo-router:
  - `app/(tabs)` contiene pantallas tab.
  - `app/exercise/[id].tsx` es detalle de ejercicio.
  - `app/workout/[id].tsx` es editor/visor de un workout.

## Calidad
- Antes de cambiar lógica central (DB/timers/unidades): agregar test de regresión.
- Preferir funciones puras (services) y evitar side effects en componentes.

