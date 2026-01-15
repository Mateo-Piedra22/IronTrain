# Cambios Recientes (Estabilidad + UI)

## SQLite / Carga de Datos
- Se redujo drásticamente el número de consultas para el calendario usando una única consulta agrupada (evita N+1).
- Se añadió caché de corto plazo para eventos de calendario y para historial por ejercicio.
- Se invalidan cachés automáticamente cuando se agregan/actualizan/borran sets o cambia el estado del workout.
- Se normalizaron parámetros SQL para evitar `undefined` en bindings (se convierte a `null`), reduciendo rechazos en `prepareAsync`.

## Historial de Series
- Se mejoró el modal de historial con caché (menos recargas) y cierre con botón de alto contraste.

## Gráficos (Alineación)
- Se ajustaron márgenes/espaciados (`initialSpacing/endSpacing`) y anchos para eliminar el “desplazamiento” hacia la derecha.

## UI / Contraste y Botones
- Se corrigieron botones críticos con bajo contraste (texto oscuro en fondo primario) a texto blanco.
- Se corrigieron iconos X/cancelar cuando el fondo era claro (evitando blanco sobre blanco).

