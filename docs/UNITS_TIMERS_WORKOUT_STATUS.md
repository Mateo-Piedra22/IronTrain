# Unidades, timers y estado de workout

## Unidades (kg/lbs)
### Política
- Base interna recomendada: **kg**.
- Display/entrada: depende de `weightUnit` (settings).

### Implicaciones
- Cálculos como Wilks/DOTS se realizan en kg; si el usuario está en lbs, se convierte explícitamente.
- Body weight se guarda en kg y se muestra en kg/lbs según preferencia.

## Rest timer
### Requisitos
- No drift: el conteo debe ser correcto aunque la app vaya a background.
- Botones: sumar tiempo, pausar/reanudar, reiniciar, cancelar.

### Implementación
- Store: [timerStore.ts](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/src/store/timerStore.ts)
  - Se basa en `endAtMs` y calcula `timeLeft` con `Date.now()`.
- Overlay: [TimerOverlay.tsx](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/components/TimerOverlay.tsx)
  - Tiquea al iniciar y al volver a foreground.

## Workout timer (duración)
- El timer del workout usa delta real por timestamp y persiste `duration` periódicamente.
- Implementación en store: [workoutStore.ts](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/src/store/workoutStore.ts)

## Estado Active vs Finished
### Definición
- Active (`in_progress`): editable, permite registrar sets, timer activo.
- Finished (`completed`): read-only, no permite editar ni agregar sets.

### UX
- La pantalla de workout permite cambiar estado con un switch y confirmación.
- Si un workout finalizado se abre desde el detalle de ejercicio, la pestaña de tracking queda bloqueada.

