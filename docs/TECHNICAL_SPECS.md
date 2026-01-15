# Especificaciones técnicas

Este documento resume decisiones técnicas y reglas del sistema (no es un manual de uso).

## Arquitectura
Referencia: [ARCHITECTURE.md](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/docs/ARCHITECTURE.md)

## Modelo de datos (resumen)
### Workout
- `status`: `in_progress` o `completed`.
- `is_template`: 1 indica plantilla (editable como template, no como sesión).
- Regla: cuando `status = completed`, el workout es read-only en UI y store.

### WorkoutSet
- Validación: no negativos.
- Ghost values: al crear sets, se sugiere desde el set previo (workout actual) o historial.

### Plate inventory
- La PK incluye `unit` para permitir kg y lbs simultáneamente.

## Unidades
Referencia: [UNITS_TIMERS_WORKOUT_STATUS.md](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/docs/UNITS_TIMERS_WORKOUT_STATUS.md)

## Timers
- Rest timer: por timestamp de fin (sin drift).
- Workout timer: por delta real (resistente a background).
