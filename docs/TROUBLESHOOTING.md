# Troubleshooting

## El rest timer se ve “congelado”
- Al volver a foreground, el overlay recalcula `timeLeft`.
- Si no aparece: verificar que el timer tenga `duration > 0` o `timeLeft > 0`.

## Unidades inconsistentes
- La app asume kg como base interna para sets y body weight.
- Si existen datos antiguos cargados en lbs sin metadata, no se pueden inferir automáticamente.

## Workouts finalizados siguen editables
- Verificar que el workout esté en `status = completed`.
- La UI debe bloquear edición y el store debe negar escrituras.

