# Changelog

## 1.4.0 (Unreleased)
- Soporte para múltiples temas (claro/oscuro).
- Soporte para diferentes idiomas (inglés/español).
- Conexión con múltiples dispositivos (relojes/bands compatibles).
- Vinculación con servicios de salud (Fitbit, Garmin, etc.) para sincronización de datos.

## 1.3.2 (2026-02-11)
- Rework del IntervalTimer.
- Mejora del calculo de discos.

## 1.3.1 (2026-01-16)
- Se añadió SafeAreaView a todos los componentes modales para mejorar la compatibilidad con los dispositivos.

## 1.3.0 (2026-01-16)
- Implementar soporte completo para diferentes tipos de ejercicios (peso_repeticiones, solo_repeticiones, solo_peso, distancia_tiempo).
- Añadir validación y limpieza de datos para series basadas en el tipo de ejercicio.
- Mejorar el modal del historial para mostrar diferentes métricas por tipo de ejercicio.
- Mejorar la copia de entrenamientos con opciones avanzadas y resolución de conflictos.
- Actualizar la pantalla de análisis con resúmenes de cardio, solo repeticiones y solo peso.
- Corregir la posición de la superposición del temporizador y añadir inserciones de área segura.
- Añadir un script de sincronización de contenido para el sitio web y actualizar la página de descargas.
- Mejorar la validación de formularios y el manejo de errores en varios componentes.

## 1.2.0 (2026-01-15)
- Rework settings: mejor organización y acceso rápido.
- Backup v4: export/import con categorías incluidas y validación más robusta.
- Sistema de actualizaciones: notificaciones automáticas y opción para desactivar.
- Notificaciones: mejor gestión de permisos y prioridades.

## 1.1.0 (2026-01-15)
- Backups v3: export/import con categorías incluidas y validación más robusta.
- Restore sólido: modo sobrescritura real, transaccional (rollback en fallo) y tolerante a tablas legacy/no existentes.
- Factory reset pro: restablecimiento completo (datos + settings) con reseed seguro.
- Diario (Daily Log) ultra pro: resumen por ejercicio con chips (series/reps/volumen/distancia-tiempo) y mejor serie; mejor tipado por `exercise_type`.
- Español consistente: tabs, ajustes, plantillas, modales y mensajes clave unificados.

## 1.0.0 (2026-01-15)
- Timers robustos: rest timer sin drift y workout timer por delta real.
- Unidades coherentes: conversión kg/lbs centralizada y aplicada en UI/cálculos.
- Plate inventory: migración para PK con `unit`.
- UX: bloqueo real de edición en workouts finalizados.
