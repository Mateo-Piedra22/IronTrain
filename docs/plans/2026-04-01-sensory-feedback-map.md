# Mapa sensorial de IronTrain (mobile)

Fecha: 2026-04-01

## 1) Mapa funcional de la app

### Núcleo de navegación
- `app/_layout.tsx`: bootstrap global, overlays, toasts, banners, sync y modales globales.
- `app/(tabs)/_layout.tsx`: navegación principal por tabs.
- Tabs principales:
  - `app/(tabs)/index.tsx` (Diario)
  - `app/(tabs)/exercises.tsx` (Biblioteca)
  - `app/(tabs)/analysis.tsx` (Análisis)
  - `app/(tabs)/social.tsx` (Social)

### Flujos secundarios / detalle
- Entrenamiento y ejecución:
  - `app/workout/[id].tsx`
  - `app/body/index.tsx`
- Ejercicios:
  - `app/exercise/[id].tsx`
  - `app/exercises/[id].tsx`
  - `app/exercises/exercise-modal.tsx`
- Compartidos / social:
  - `app/share/routine/[id].tsx`
- Utilidades:
  - `app/tools/plate-calculator.tsx`
  - `app/templates/index.tsx`
- Pantallas auxiliares:
  - `app/settings.tsx`, `app/feedback.tsx`, `app/changelog.tsx`, `app/callback.tsx`, `app/modal.tsx`

### Capa reusable de UI
- `components/` centraliza UI y modales del producto.
- `components/IronButton.tsx` es el punto de entrada más transversal para acciones explícitas del usuario.
- `components/ui/ToastContainer.tsx` + `src/utils/notify.ts` concentran feedback contextual.

## 2) Estado actual de feedback sensorial

- Ya existe haptic en varios lugares (`app/`, `components/`, `src/`), pero estaba fragmentado.
- Existía riesgo de inconsistencia por estilos/llamadas directas de `expo-haptics` repetidas.
- `ConfigService` ya provee `hapticFeedbackEnabled`, por lo que la app tiene una base correcta para gobernar esta capa.

## 3) Cambios aplicados en esta iteración

1. Se creó una capa única: `src/utils/sensoryFeedback.ts`
   - Unifica tipos de feedback (`selection`, `tapLight`, `tapMedium`, `success`, `warning`, `error`).
   - Respeta `hapticFeedbackEnabled` de configuración.
   - Incluye fallback de vibración en Android si falla haptic nativo.

2. Se elevó cobertura transversal de interacción:
   - `components/IronButton.tsx`
     - Haptic unificado en press.
     - Animación de presión con `react-native-reanimated` (escala spring en press in/out).
   - `app/(tabs)/_layout.tsx`
     - Haptic de selección al cambiar de tab.
   - `src/utils/notify.ts`
     - Toasters y banner migrados a la capa sensorial unificada.

## 4) Próximas prioridades (alto impacto)

1. Migrar llamadas directas restantes de `expo-haptics` en pantallas críticas a `triggerSensoryFeedback`.
2. Añadir presets de animación de entrada/salida para:
   - cards interactivas,
   - modales de acción rápida,
   - confirmaciones de guardado.
3. Definir matriz UX por evento (tap, éxito, error, warning, delete, reorder) para mantener consistencia.
4. Agregar pruebas unitarias de la capa sensorial (mock de haptics/vibration) y smoke tests en componentes clave.

## 5) Resultado esperado

- Menos dispersión técnica.
- Feedback táctil y visual más consistente en la mayor parte del flujo diario.
- Base escalable para ampliar “sensación de respuesta” sin reescribir pantallas completas.
