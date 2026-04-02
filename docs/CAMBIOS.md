# Política de cambios

Este documento define cómo introducir cambios en IronTrain sin degradar estabilidad.

## Reglas

1. Todo cambio entra por PR.
2. Toda PR debe pasar CI y checks de seguridad.
3. Cambios de datos requieren estrategia de rollback.
4. Cambios visibles al usuario requieren documentación.

## Tipos de cambio

- **Patch:** fixes sin cambio de comportamiento público relevante.
- **Minor:** nuevas capacidades backward-compatible.
- **Major:** cambios con impacto de compatibilidad o migración.

## Checklist previo a merge

- Tests + typecheck en verde.
- Riesgos documentados.
- Docs actualizadas.
