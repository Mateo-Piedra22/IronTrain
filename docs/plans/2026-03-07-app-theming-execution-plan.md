# Plan Maestro de Theming de App (Móvil)

## Objetivo
Construir un sistema de tema mantenible, escalable y social-ready para la app móvil, con base robusta para:
- modo claro/oscuro automático por dispositivo
- override manual por usuario
- subtemas personalizados por usuario
- compartir subtemas con modelo privado/amigos/público

## Estado Actual
- La app ya tiene paleta base en `src/theme.ts`.
- Existen muchos usos directos de color en pantallas y componentes.
- Se inició la base de Fase A con tipado de tokens y motor de patches.
- Se corrigieron modales críticos para scroll/contraste y consistencia visual.
- Inventario parcial de literales de color tras lotes 7 y 8: 191 ocurrencias en 46 archivos app/components/src.

## Principios de Implementación
- No romper flujo productivo: compatibilidad retroactiva mientras se migra.
- Tokenizar primero, migrar después: evitar refactors masivos no controlados.
- Priorizar componentes compartidos antes que pantallas puntuales.
- Mantener validación estricta de colores para evitar temas inválidos.
- Dejar trazabilidad completa por archivo y fase.

## Precauciones Críticas
- No introducir cambios de tema acoplados al estado de navegación sin capa intermedia.
- No mezclar tokens semánticos con colores literales en componentes nuevos.
- No permitir patches de color sin validación de formato HEX.
- No avanzar a social-sharing sin resolver persistencia y versionado de subtema.
- No habilitar dark mode global sin validar contraste en modales, cards y textos secundarios.

## Fases Detalladas

### Fase A — Base de Tokens y Compatibilidad (Completada)
Entregables:
- Contratos tipados de tema (`ThemeMode`, `ThemeTokens`, `ThemeColors`).
- Catálogo core claro/oscuro.
- Funciones de resolución de modo (`light/dark/system`).
- Motor de patch para subtemas con serialización y deserialización.
- Helpers visuales para overlays/sombras/alpha.
- Corrección de modales críticos y eliminación de hardcodes visuales en componentes base tocados.

Checklist de salida:
- Tipado compilando sin errores.
- Compatibilidad con `Colors` legacy preservada.
- UI crítica de notificaciones y changelog funcional y estable.

### Fase B — Activación Runtime de Tema
Entregables:
- Provider único de tema en runtime (modo, tokens activos, selección actual).
- Integración con `themeMode` de configuración del usuario.
- Resolución `system` vía esquema del dispositivo.
- Re-render coherente de navegación, status bar y componentes globales.

Checklist de salida:
- Cambio de tema en vivo sin reinicio.
- Persistencia correcta de preferencia.
- Sin regressions visuales en tabs, modales y componentes compartidos.

### Fase C — Migración Estructural de Hardcodes
Entregables:
- Migración incremental de colores literales hacia tokens semánticos.
- Priorización: componentes compartidos, luego pantallas de alto tráfico.
- Reglas para componentes nuevos (sin hardcode).

Checklist de salida:
- Reducción sostenida de hardcodes por lote de archivos.
- Cobertura de componentes base de UI.
- Reporte de deuda remanente con prioridad por impacto.

### Fase D — Subtemas Personalizados (Local + Sync)
Entregables:
- Estructura `SubthemePack` con par light/dark.
- CRUD local de subtemas.
- Aplicación de patch validado sobre tema base.
- Preparación de sync entre dispositivos.

Checklist de salida:
- Crear, editar, duplicar, activar y eliminar subtemas.
- Rollback seguro ante tokens inválidos.
- Versionado básico de subtema por usuario.

### Fase E — Compartir Subtemas
Entregables:
- Publicación de subtemas en modalidad privada/amigos/público.
- Importación y clonación de temas compartidos.
- Metadatos de autor, fecha y versión.

Checklist de salida:
- Flujo completo publicar→descubrir→aplicar.
- Reglas básicas de seguridad y moderación.
- Compatibilidad con modelo social ya usado en rutinas.

## Trazabilidad de Archivos (Ronda Actual)
- Modificado: `components/WhatsNewModal.tsx`
- Modificado: `components/GlobalNoticeHandler.tsx`
- Modificado: `components/ui/ConfirmModal.tsx`
- Modificado: `components/PRCenter.tsx`
- Modificado: `components/RoutineDetailModal.tsx`
- Modificado: `components/IntervalTimerModal.tsx`
- Modificado: `app/(tabs)/social.tsx`
- Modificado: `app/tools/plate-calculator.tsx`
- Modificado: `components/SetRow.tsx`
- Modificado: `app/settings.tsx`
- Modificado: `app/body/index.tsx`
- Modificado: `components/WorkoutStatusBar.tsx`
- Modificado: `components/analysis/AnalysisOverview.tsx`
- Modificado: `components/analysis/AnalysisTrends.tsx`
- Modificado: `components/analysis/AnalysisRecords.tsx`
- Modificado: `components/WorkoutLog.tsx`
- Modificado: `components/ExerciseFormModal.tsx`
- Modificado: `components/TimerOverlay.tsx`
- Modificado: `components/RestTimer.tsx`
- Modificado: `app/exercise/[id].tsx`
- Modificado: `components/CalculatorsModal.tsx`
- Modificado: `components/CategoryManager.tsx`
- Modificado: `components/BadgeSelectorModal.tsx`
- Modificado: `components/ui/ColorPicker.tsx`
- Modificado: `src/theme.ts`
- Modificado: `src/theme-engine.ts`
- Creado: `docs/plans/2026-03-07-app-theming-execution-plan.md`
- Línea base observada al inicio de la ronda: 541 ocurrencias en 69 archivos app/components/src.
- Cierre lote 1: 524 ocurrencias en 66 archivos.
- Cierre lote 2: 441 ocurrencias en 64 archivos.
- Cierre lote 3: 373 ocurrencias en 61 archivos.
- Cierre lote 4: 311 ocurrencias en 58 archivos.
- Cierre lote 5-6: 265 ocurrencias en 51 archivos.
- Cierre lote 7-8: 191 ocurrencias en 46 archivos.
- Delta acumulado desde línea base: -350 ocurrencias y -23 archivos con literales directos.

## Criterios de “Listo para Fase B”
- Base de tokens tipada y estable.
- Helpers visuales comunes centralizados.
- Modales globales sin hardcodes críticos y con scroll estable.
- Tests y typecheck pasando.

## Próximo Paso Operativo
Implementar Fase B sobre provider/runtime con integración de `themeMode` en configuración, manteniendo fallback seguro para componentes legacy mientras avanza Fase C.
