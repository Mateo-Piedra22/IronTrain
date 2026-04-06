# Política de archivado de snapshots y cambios (Espacios compartidos)

Fecha: 2026-04-06  
Versión: v1

## Objetivo

Reducir crecimiento técnico de `shared_routine_snapshots` y `shared_routine_changes` sin perder trazabilidad operativa ni capacidad de recuperación.

## Alcance

- Tablas: `shared_routine_snapshots`, `shared_routine_changes`.
- No aplica a miembros, invitaciones ni comentarios.

## Reglas de retención v1

## Snapshots (`shared_routine_snapshots`)

- Mantener siempre las últimas `30` revisiones por espacio.
- Considerar candidato a archivado recién después de `120` días.
- Hard delete solo para registros archivados con antigüedad mayor a `365` días.

## Cambios (`shared_routine_changes`)

- Mantener siempre los últimos `200` eventos por espacio.
- Considerar candidato a archivado recién después de `90` días.
- Hard delete solo para registros archivados con antigüedad mayor a `240` días.

## Protecciones obligatorias

1. Nunca archivar el snapshot actual de `shared_routines.current_snapshot_id`.
2. Nunca archivar snapshots asociados a revisiones pendientes.
3. Proteger eventos `rollback` recientes (hasta 180 días) para auditoría operativa.

## Cadencia operativa

- Dry-run semanal (solo reporte de candidatos).
- Ejecución mensual controlada (ventana de bajo tráfico).
- Cada ejecución requiere reporte previo y validación por admin.

## KPIs mínimos de control

- Candidatos semanales por tabla.
- Registros archivados por ejecución.
- Tiempo medio de consulta en historial/revisiones antes y después.
- Incidentes por ausencia de trazabilidad (objetivo: 0).

## Rollback operativo

Si se detecta impacto funcional:

1. Detener archivado mensual.
2. Restaurar desde backup más reciente (si aplicó hard delete).
3. Forzar modo dry-run hasta nueva aprobación de política.
