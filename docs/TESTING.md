# Testing

## Herramientas
- Jest (preset `jest-expo`).

## Qué se testea
- Services: cálculos, validaciones y reglas de negocio.
- Stores: timers, estado de workout, bloqueos.

## Suites relevantes
- `src/services/__tests__/*`
- `src/store/__tests__/*`

## Regla de regresión
Cada bug corregido agrega un test mínimo que lo reproduce.

