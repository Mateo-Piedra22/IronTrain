# Base de datos (SQLite)

## Motor
- Expo SQLite (local).
- Inicialización/migraciones en [DatabaseService.ts](file:///c:/Users/mateo/OneDrive/Escritorio/Work/Programas/IronTrain/src/services/DatabaseService.ts).

## Tablas principales
- `categories`
- `exercises`
- `workouts`
- `workout_sets`
- `settings`
- `measurements`
- `plate_inventory`

## Migraciones relevantes
- `workout_sets`: columnas legacy (`rpe`) y `superset_id`.
- `plate_inventory`: la clave primaria incluye `unit` para soportar kg y lbs:
  - PK: `(weight, type, unit)`.

## Reglas de integridad
- Escrituras multi-step (p.ej. update de inventario) deben usar transacción.
- `workout_sets` se borra con `ON DELETE CASCADE` al borrar un workout.

