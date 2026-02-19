# Changelog

## 1.4.0 (Unreleased)
- Soporte para múltiples temas (claro/oscuro).
- Soporte para diferentes idiomas (inglés/español).
- Conexión con múltiples dispositivos (relojes/bands compatibles).
- Vinculación con servicios de salud (Fitbit, Garmin, etc.) para sincronización de datos.

## 1.3.4 (2026-02-19)
- **Robustez y Estabilidad Limit-Proof**: Se refactorizó el núcleo de renderizado (`AppLayout`, `Settings`) eliminando selectores inestables que causaban crashes críticos al inicio. Se implementó un manejo de errores robusto en todos los módulos de análisis para prevenir estados vacíos rotos.
- **Visual & UX Polish**: Rediseño completo del sistema de navegación en Análisis (Tabs tipo píldora de alto contraste) y corrección de legibilidad en `DateStrip` y `AnalysisTools`. Ajustes de espaciado uniformes en todas las sub-secciones.
- **Heatmap de Consistencia 2.0**: Nueva lógica de renderizado que soporta semanas parciales, alineación precisa de etiquetas de mes, coloreado distintivo para días vacíos (`iron[300]`) y auto-scroll inteligente a la fecha actual.
- **Calculadora de Discos Restored**: Se reintrodujo la calculadora de discos como una pestaña dedicada dentro del modal de herramientas, con visualización gráfica de carga de barra y soporte para inventarios estándar (kg/lbs).
- **Mejoras en el sistema de actualizaciones**: Se mejoró el sistema de actualizaciones para que sea más robusto y fácil de usar.
- **Mejoras en el daily log**: Se mejoró el daily log para que sea más fácil e intuitivo.
- **Mejoras en el análisis de tendencias**: Se mejoró el análisis de tendencias para que sea más profesional y cómodo.

## 1.3.3 (2026-02-14)
- **Corrección de Integridad de Datos**: Solución definitiva al cálculo erróneo de volúmenes en el módulo de análisis, asegurando precisión en reportes históricos.
- **Refinamiento de UI**: Ajustes de espaciado crítico en el modal de "Interval Timer" para mejorar la usabilidad en dispositivos de pantalla pequeña.
- **Sistema de Actualizaciones Optimizado**: Mejoras en el flujo de detección y notificación de nuevas versiones.

## 1.3.2 (2026-02-11)
- **Interval Timer Re-engineering**: Rework completo del temporizador de intervalos, optimizando la precisión del cronómetro y la experiencia de usuario durante las sesiones.
- **Algoritmo de Carga de Discos**: Refinamiento en la lógica de cálculo para sugerir combinaciones de discos más eficientes y realistas.

## 1.3.1 (2026-01-16)
- **Compatibilidad Universal de UI**: Implementación sistemática de `SafeAreaView` en todos los modales y pantallas críticas para garantizar una visualización perfecta en dispositivos con notch e islas dinámicas.

## 1.3.0 (2026-01-16)
- **Soporte Multi-Tipo de Ejercicio**: Arquitectura extendida para soportar ejercicios de `peso_repeticiones`, `solo_repeticiones`, `solo_peso` y `distancia_tiempo` con validación específica por tipo.
- **Pipeline de Validación de Datos**: Sistema robusto de sanitización de inputs para prevenir la corrupción de datos en series atípicas.
- **Métricas Avanzadas en Historial**: Visualización contextual de métricas según el tipo de ejercicio en el historial de rendimiento.
- **Duplicación Inteligente de Entrenamientos**: Nueva lógica para copiar sesiones previas con resolución de conflictos de IDs y fechas.
- **Dashboard de Análisis Extendido**: Nuevas tarjetas de resumen para Cardio, Calistenia y Peso Corporal.
- **Sincronización de Contenidos Web**: Scripts automatizados para mantener la web de descargas sincronizada con el repositorio.

## 1.2.0 (2026-01-15)
- **Módulo de Ajustes Refactorizado**: Nueva arquitectura de configuración centralizada para mejorar la mantenibilidad y el acceso del usuario.
- **Backup System v4**: Motor de importación/exportación reescrito para incluir categorías personalizadas y validación de esquema JSON estricta.
- **Notificaciones de Update**: Sistema proactivo de alertas para nuevas versiones con opción de "silenciar" para usuarios avanzados.
- **Gestión de Permisos**: Flujo de solicitud de permisos de notificaciones optimizado y menos intrusivo.

## 1.1.0 (2026-01-15)
- **Backup System v3 (Transactional)**: Implementación de restauración transaccional con rollback automático en caso de fallo, garantizando la integridad de la base de datos.
- **Factory Reset Protocol**: Opción de restablecimiento de fábrica seguro que limpia datos y configuraciones reiniciando las semillas de la base de datos.
- **Daily Log "Ultra Pro"**: Visualización enriquecida del diario de entrenamiento con "Chips" de resumen (series/volumen/distancia) y tipado estricto.
- **Consistencia de Idioma**: Unificación de terminología en español a través de toda la interfaz (tabs, modales, alertas).

## 1.0.0 (2026-01-15)
- **Precision Timing Engine**: Motor de cronometraje de alta precisión sin "drift" temporal para descansos y duración de sesión.
- **Sistema de Unidades Unificado**: Conversión bidireccional Kg/Lbs centralizada, aplicada consistentemente en UI y cálculos de persistencia.
- **Migración de Inventario de Discos**: Actualización del esquema de base de datos para soportar claves primarias compuestas con unidades.
- **Bloqueo de Inmutabilidad**: Restricción de edición para entrenamientos finalizados para preservar la integridad histórica.
