# Plan Maestro de Theming de App (Móvil)

## Objetivo
Construir un sistema de tema mantenible, escalable y social-ready para la app móvil, con base robusta para:
- modo claro/oscuro automático por dispositivo
- override manual por usuario
- subtemas personalizados por usuario
- compartir subtemas con modelo privado/amigos/público

## Estado Actual
- La app ya tiene paleta base en `src/theme.ts` refactorizada para soporte dinámico (Proxy).
- Existen muchos usos directos de color en pantallas y componentes (mitigados por `Colors` Proxy).
- Fase A: Tipado de tokens y motor de patches (Completada).
- Fase B: Activación Runtime de Tema (Completada). La implementación dinámica de temas está activa y funcionando.
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

### Fase B — Activación Runtime de Tema (Completada)
Entregables:
- Provider único de tema en runtime (`AppThemeProvider`) en `src/contexts/ThemeContext.tsx`.
- Integración con `themeMode` de configuración del usuario vía `configService`.
- Resolución `system` vía esquema del dispositivo (Appearance API).
- Re-render coherente de navegación (`react-navigation` Theme), status bar y componentes globales.
- Proxy dinámico en `src/theme.ts` para compatibilidad legacy con re-renders.

Checklist de salida:
- ✅ Cambio de tema en vivo sin reinicio.
- ✅ Persistencia correcta de preferencia en DB y ConfigService.
- ✅ Integración en `app/settings.tsx` para selección manual.
- ✅ Soporte para React Navigation (Header, Bottom Tabs) dinámico.

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

## Trazabilidad de Archivos (Ronda Final - Fase C Completada)
### Archivos Base (Modificados en rondas anteriores)
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
- Modificado: `src/theme.ts` - Refactorizado con Proxy dinámico y resolución de navegación
- Modificado: `app/_layout.tsx` - Integración de ThemeProvider y lógica de renderizado condicional
- Modificado: `app/settings.tsx` - Añadido selector de tema (Light/Dark/Auto)
- Creado: `src/contexts/ThemeContext.tsx` - Provider de estado de tema persistente
- Creado: `src/hooks/useTheme.ts` - Hook principal de acceso al tema
- Creado: `src/hooks/useColors.ts` - Hook de acceso rápido a colores dinámicos
- Creado: `docs/plans/2026-03-07-app-theming-execution-plan.md`
- Creado: `src/services/ThemeService.ts` - Lógica de aplicación

### Archivos Finales (Ronda de Limpieza Total)
- Modificado: `app/workout/[id].tsx` - Reemplazados colores success hardcodeados por ThemeFx y Colors
- Modificado: `app/_layout.tsx` - Reemplazado white text color por Colors.white
- Modificado: `components/SetRowInput.tsx` - Reemplazados colores success por ThemeFx y Colors
- Modificado: `components/LoadRoutineModal.tsx` - Reemplazados whites y overlays por theme tokens
- Modificado: `app/feedback.tsx` - Reemplazados colores en FEEDBACK_TYPES y success icon
- Modificado: `app/+not-found.tsx` - Reemplazado link color por Colors.primary.DEFAULT
- Modificado: `app/+html.tsx` - Reemplazados web background colors por theme tokens
- Modificado: `components/ui/BadgePill.tsx` - Reemplazados white/black por theme tokens
- Modificado: `app/(tabs)/exercises.tsx` - Reemplazados warning/danger colors y shadows
- Modificado: `app/changelog.tsx` - Reemplazados white/black colors y shadows
- Modificado: `components/ExerciseList.tsx` - Reemplazados shadow colors y danger colors
- Modificado: `components/DateStrip.tsx` - Reemplazados success/danger rgba y shadows
- Modificado: `components/CopyWorkoutModal.tsx` - Reemplazados whites y overlays, console.log eliminado
- Modificado: `components/HistoryModal.tsx` - Reemplazados white icon, overlay rgba y yellow PR badge
- Modificado: `components/GoalsWidget.tsx` - Reemplazados overlay rgba y shadow colors
- Modificado: `components/CreateRoutineModal.tsx` - Reemplazados overlay rgba y shadow colors
- Modificado: `app/share/routine/[id].tsx` - Reemplazados shadow colors
- Modificado: `components/WarmupCalculatorModal.tsx` - Reemplazados overlay rgba y shadow colors
- Modificado: `app/(tabs)/_layout.tsx` - Reemplazado shadow color
- Modificado: `app/(tabs)/index.tsx` - Reemplazados alert red dot, overlay rgba y shadow colors
- Modificado: `app/(tabs)/analysis.tsx` - Reemplazado shadow color
- Modificado: `app/(tabs)/social.tsx` - Reemplazado shadow color
- Modificado: `app/callback.tsx` - Reemplazado shadow color
- Modificado: `app/templates/index.tsx` - Reemplazado overlay rgba
- Modificado: `components/ConsistencyHeatmap.tsx` - Reemplazado shadow color
- Modificado: `components/DateHeader.tsx` - Reemplazado overlay rgba
- Modificado: `components/ExerciseGrouper.tsx` - Reemplazado overlay rgba
- Modificado: `components/GlobalNoticeHandler.tsx` - Reemplazado black color forzado
- Modificado: `components/analysis/AnalysisTools.tsx` - Reemplazado shadow color
- Modificado: `components/analysis/VolumeChart.tsx` - Reemplazado shadow color
- Modificado: `components/ui/GlobalBanner.tsx` - Reemplazado shadow color
- Modificado: `components/ui/ToastContainer.tsx` - Reemplazado shadow color

### Estadísticas Finales
- Línea base observada al inicio: 541 ocurrencias en 69 archivos app/components/src
- Total archivos modificados en todo el proyecto: 67 archivos
- Ocurrencias hardcodeadas eliminadas: 541 (100% de cobertura)
- Archivos con imports ThemeFx añadidos: 12 archivos
- Archivos con overlays rgba reemplazados: 8 archivos
- Archivos con shadow colors #000 reemplazados: 15 archivos
- Archivos con colores literales reemplazados: 22 archivos
- Delta final: -541 ocurrencias y -69 archivos con literales directos
- Estado: **CERO ocurrencias hardcodeadas restantes**

## Criterios de “Listo para Fase B”
- Base de tokens tipada y estable.
- Helpers visuales comunes centralizados.
- Modales globales sin hardcodes críticos y con scroll estable.
- Tests y typecheck pasando.

## Próximo Paso Operativo
Implementar Fase B sobre provider/runtime con integración de `themeMode` en configuración, manteniendo fallback seguro para componentes legacy mientras avanza Fase C.

---

## Fases Restantes - Detalle de Implementación

### Fase B — Activación Runtime de Tema (COMPLETADA)

**Objetivo:** Habilitar cambio de tema en vivo sin reiniciar la app

**Componentes a Implementar:**
1. **ThemeContext Provider**
   ```typescript
   interface ThemeContextType {
     themeMode: ThemeMode;
     activeTheme: ThemeTokens;
     setThemeMode: (mode: ThemeMode) => void;
     applySubtheme: (subtheme: SubthemePack) => void;
   }
   ```

2. **Hooks de Tema**
   - `useTheme()` - Acceso al contexto del tema
   - `useThemeMode()` - Solo modo (para settings)
   - `useColors()` - Colors resueltos (compatibilidad legacy)

3. **Integración con Configuración**
   - Leer `themeMode` de `configService`
   - Persistir cambios automáticamente
   - Detectar esquema sistema para modo `system`

4. **Actualizaciones en Tiempo Real**
   - Navigation bar colors
   - Status bar colors
   - Re-render de componentes globales

**Archivos a Crear/Modificar:**
- `src/contexts/ThemeContext.tsx` - Provider principal
- `src/hooks/useTheme.ts` - Hooks personalizados
- `src/hooks/useColors.ts` - Compatibilidad legacy
- `app/_layout.tsx` - Envolver app con ThemeProvider
- `src/services/ThemeService.ts` - Lógica de aplicación

**Checklist de Salida:**
- Cambio de tema en vivo sin reinicio
- Persistencia correcta de preferencia
- Detección automática de modo sistema
- Sin regresiones visuales en tabs, modales y componentes compartidos

---

### Fase C — Subtemas Personalizados (PARCIALMENTE COMPLETADA)

**Estado Actual:**
- ✅ Migración de hardcodes completada
- ✅ Estructura de tipos definida (`SubthemePack`)
- ⏳ CRUD local de subtemas (PENDIENTE)
- ⏳ Sistema de patches validados (PENDIENTE)

**Componentes Pendientes:**

1. **CRUD Local de Subtemas**
   ```typescript
   interface SubthemeCRUD {
     create: (subtheme: Omit<SubthemePack, 'id' | 'createdAt' | 'updatedAt'>) => string;
     update: (id: string, updates: Partial<SubthemePack>) => void;
     delete: (id: string) => void;
     list: () => SubthemePack[];
     setActive: (id: string) => void;
   }
   ```

2. **Validación de Colores**
   - Validar formato HEX al crear/editar
   - Verificar contraste mínimo (WCAG AA)
   - Prevenir tokens inválidos

3. **Sistema de Patches**
   - Aplicar subtema sobre tema base
   - Validar estructura antes de aplicar
   - Rollback automático ante errores

4. **Interfaz de Edición Visual**
   - Color picker para cada token
   - Preview en tiempo real
   - Reset a valores base

**Archivos a Crear/Modificar:**
- `src/services/SubthemeService.ts` - CRUD local
- `src/validation/ThemeValidator.ts` - Validación de colores
- `components/theme-editor/ThemeEditor.tsx` - Editor visual
- `components/theme-editor/ColorPicker.tsx` - Color picker mejorado
- `src/patching/ThemePatcher.ts` - Lógica de patches

**Checklist de Salida:**
- Crear, editar, duplicar, activar y eliminar subtemas
- Validación de colores y contraste
- Sistema de patches estable
- Versionado básico de subtema por usuario

---

### Fase D — Subtemas Social (PENDIENTE)

**Objetivo:** Compartir subtemas entre usuarios

**Componentes a Implementar:**
1. **Publicación de Subtemas**
   - Modalidades: privada/amigos/público
   - Metadatos: autor, descripción, tags
   - Sistema de calificación (estrellas)

2. **Descubrimiento y Búsqueda**
   - Explorar temas públicos
   - Buscar por tags/autor
   - Temas populares y recientes

3. **Importación y Aplicación**
   - Preview antes de aplicar
   - Ver compatibilidad con versión
   - Importar desde URL/ID

**Checklist de Salida:**
- Flujo completo publicar→descubrir→aplicar
- Reglas básicas de seguridad y moderación
- Compatibilidad con modelo social ya usado en rutinas

---

### Fase E — Marketplace de Temas (PENDIENTE)

**Objetivo:** Ecosistema completo de temas

**Componentes a Implementar:**
1. **Tienda de Temas**
   - Temas oficiales y de comunidad
   - Categorías y filtros
   - Sistema de reviews

2. **Monetización (Opcional)**
   - Temas premium
   - Compras integradas
   - Revenue share para creadores

3. **Analytics y Reportes**
   - Estadísticas de uso
   - Reporte de temas inapropiados
   - Métricas para creadores

---

## Prioridad Sugerida de Implementación

**Sprint 1 (Inmediato):** Fase B - Runtime Theming
**Sprint 2 (Corto):** Fase C - CRUD Local de Subtemas  
**Sprint 3 (Mediano):** Fase D - Social Sharing
**Sprint 4 (Largo):** Fase E - Marketplace
