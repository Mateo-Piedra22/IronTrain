# IronTrain — Plan Técnico Ejecutable de Sistema de Temas (App + Website + API + DB)

Fecha: 2026-04-06
Estado: En ejecución (P0/P2 cerradas, P1.3 pendiente de QA físico)
Horizonte: 3 sprints (2 semanas cada uno) o 4 sprints cortos

---

## 1) Objetivo operativo

Cerrar gaps críticos del sistema de temas y dejar una arquitectura robusta, coherente y observable entre:

- App móvil (runtime de tema, Theme Studio, deep links, persistencia local/sync)
- Website (share pages, admin moderation, health/SLO)
- API social/admin themes
- Base de datos y contratos

Resultado esperado:

1. Flujo end-to-end real para compartir/importar/aplicar temas.
2. Contratos API y documentación 100% consistentes con implementación.
3. Métricas y señales de negocio confiables (installs/applies/rating).
4. Menor deuda técnica de theming legacy y mejor mantenibilidad.

---

## 2) Principios de ejecución

- Priorizar riesgo de producto y consistencia funcional (P0 antes de P1/P2).
- Cambios incrementales con feature flags donde aplique.
- No romper UX actual ni el feed social.
- Cada fase sale con criterios de aceptación verificables.

---

## 3) Alcance por prioridad

## P0 (bloqueantes funcionales)

### P0.1 — Importador móvil real para `irontrain://share/theme/:slug`

Problema:
- Existe deep link en web share de themes, pero no hay evidencia clara de handler/import flow móvil operativo end-to-end.

Entregables:
- Ruta/handler móvil para deep link de tema.
- Resolución contra endpoint público `GET /api/share/theme/:slug`.
- Conversión payload -> draft local seguro + opción de aplicar (`light`, `dark`, `both`).
- Manejo de errores (theme inexistente, rate-limit, payload inválido).

Tareas técnicas:
- [x] 1. Definir punto de entrada de deep link en app (router/linking listener).
- [x] 2. Crear servicio de import (`ThemeImportService`) con validación estricta de payload.
- [x] 3. Integrar con `ThemeContext`/`saveThemeDraft`/`setActiveThemePackId`.
- [x] 4. UX mínima: pantalla/modal de confirmación de import + resultado.
- [x] 5. Telemetría de evento (`theme_import_started|success|failed`).

Criterios de aceptación:
- [x] Abrir `irontrain://share/theme/<slug>` importa tema válido y lo deja disponible en Theme Studio.
- [x] Si falla, usuario recibe mensaje accionable y no se corrompe estado local.
- [x] Tests de integración del import flow pasando.

Estimación: 2.5–4 días
Riesgo: Medio
Dependencias: Ninguna

Estado P0.1: ✅ COMPLETADO

---

### P0.2 — Cierre de inconsistencia de contrato `publish`

Problema:
- Contrato/docs mencionan `POST /api/social/themes/:id/publish` pero no existe endpoint implementado.

Opciones (elegir una):
- Opción A (recomendada): implementar endpoint `publish` y flujo explícito de estado.
- Opción B: eliminar del contrato y mantener transición vía `PATCH visibility`.

Entregables:
- Contrato, docs, tests y código alineados.

Tareas técnicas:
- [x] 1. Decidir modelo final de transición de estados.
- [x] 2. Ajustar rutas/servicios/tests.
- [x] 3. Actualizar docs (`README` del dominio themes + roadmap).

Criterios de aceptación:
- [x] No hay endpoints “fantasma” en docs.
- [x] Tests HTTP del dominio themes reflejan flujo real.

Estimación: 0.5–1.5 días
Riesgo: Bajo
Dependencias: Ninguna

Estado P0.2: ✅ COMPLETADO

Estado Fase P0: ✅ COMPLETADA

---

## P1 (impacto alto, no bloqueante)

### P1.1 — Métricas reales de instalación/aplicación desde móvil

Problema:
- Móvil crea/actualiza themes en marketplace, pero no parece registrar `install`/`apply` en backend.

Entregables:
- Integración móvil de `POST /api/social/themes/:id/install` al aplicar tema remoto/local vinculado.
- Política clara para cuándo contar `download` vs `apply`.

Tareas técnicas:
- [x] 1. Definir trigger de install (por ejemplo al activar tema vinculado remoto).
- [x] 2. Llamar endpoint install con flags `appliedLight/appliedDark`.
- [x] 3. Retry suave/no bloqueante + fallback local.
- [x] 4. Métrica cliente para diagnósticos.

Criterios de aceptación:
- [x] Contadores de `downloads_count`/`applies_count` se mueven con uso real móvil.
- [x] No afecta latencia perceptible del apply en app.

Estimación: 1.5–2.5 días
Riesgo: Medio
Dependencias: P0.1 recomendada

Estado P1.1: ✅ COMPLETADO

---

### P1.2 — Política de persistencia/sync para claves `theme_studio_*`

Problema:
- Parte de metadata de Theme Studio se guarda en `settings` usando `as any`; hoy puede sincronizarse a cloud sin política explícita.

Entregables:
- Matriz de claves “local-only” vs “syncable”.
- Eliminación de `as any` en persistencia de tema (tipado fuerte).

Tareas técnicas:
- [x] 1. Inventariar keys de tema en `ConfigService`.
- [x] 2. Decidir por key: local-only o syncable.
- [x] 3. Implementar API tipada (`setThemeSetting/getThemeSetting`) o extender `AppConfig` explícitamente.
- [x] 4. Ajustar `localOnlyKeys` y tests de sync snapshot.

Criterios de aceptación:
- [x] Política documentada y aplicada en código.
- [x] No hay casts inseguros para claves de tema.

Estimación: 1.5–3 días
Riesgo: Medio
Dependencias: Ninguna

Estado P1.2: ✅ COMPLETADO

---

### P1.3 — Coherencia `themeMode=system` vs `app.json userInterfaceStyle`

Problema:
- `userInterfaceStyle` fijo en `dark` puede contradecir expectativa de modo `system`.

Entregables:
- Decisión explícita de producto (forzar dark o respetar system).
- Config y docs alineadas.

Tareas técnicas:
- [x] 1. Validar comportamiento actual en iOS/Android.
- [x] 2. Si se adopta system real: mover `userInterfaceStyle` a `automatic`.
- [x] 2.1 Validar en código/config que `app.json` quedó en `"userInterfaceStyle": "automatic"`.
- [x] 2.2 Ejecutar validación automatizada de tema/config (`useTheme`, `useColors`, `ConfigService`).
- [ ] 3. QA manual en dispositivos reales.

Criterios de aceptación:
- [x] Comportamiento de `system` es predecible y documentado.

Estimación: 0.5–1 día
Riesgo: Bajo
Dependencias: Ninguna

Evidencia técnica (2026-04-06):
- `app.json` configurado con `"userInterfaceStyle": "automatic"`.
- Tests ejecutados en verde:
	- `npm test -- src/hooks/__tests__/useTheme.test.tsx src/hooks/__tests__/useColors.test.ts`
	- `npm test -- src/services/__tests__/ConfigService.test.ts`

Estado P1.3: 🟡 EN PROGRESO (pendiente únicamente QA manual en dispositivo físico)

Checklist QA manual en dispositivo físico (bloqueante para cerrar P1):
- [ ] Android real: `themeMode=system` sigue cambio del sistema (light -> dark) sin reiniciar app.
- [ ] iOS real: `themeMode=system` sigue cambio del sistema (light -> dark) sin reiniciar app.
- [ ] Al volver de background, conserva `effectiveMode` correcto según esquema del sistema.
- [ ] `statusBarStyle` coincide con el modo efectivo después del cambio de esquema.
- [ ] Persistencia: cerrar y reabrir app mantiene `themeMode=system` y respeta esquema del sistema actual.

Regla de cierre P1.3:
- Marcar `Tarea 3` y `Estado P1.3` como ✅ solo cuando el checklist anterior esté completo en ambos dispositivos reales.

---

## P2 (hardening / deuda técnica)

### P2.1 — Hardening de DB (enums/check constraints)

Problema:
- Campos críticos de themes en DB están como `text` y dependen de validación API.

Entregables:
- Migraciones con `CHECK`/enum para `status`, `visibility`, `kind`, `reason`.

Tareas técnicas:
- [x] 1. Añadir constraints sin downtime.
- [x] 2. Validar datos legacy.
- [x] 3. Actualizar schema Drizzle + tests.

Criterios de aceptación:
- [x] DB rechaza estados inválidos aunque falle validación app/API.

Estimación: 1.5–2 días
Riesgo: Medio
Dependencias: P0.2

Estado P2.1: ✅ COMPLETADO

---

### P2.2 — Limpieza de theming legacy

Problema:
- Conviven piezas legacy (`Themed.tsx`, `constants/Colors.ts`) con sistema dinámico.

Entregables:
- Camino único de consumo de colores (`useTheme/useColors`).
- Legacy deprecado o removido sin romper pantallas.

Tareas técnicas:
- [x] 1. Inventario de usos reales legacy.
- [x] 2. Migrar referencias a hooks actuales (sin referencias productivas activas; no-op de migración).
- [x] 3. Marcar/remover módulos legacy.

Criterios de aceptación:
- [x] Sin dependencias activas al path legacy en pantallas productivas.

Estimación: 1–2 días
Riesgo: Bajo
Dependencias: Ninguna

Estado P2.2: ✅ COMPLETADO

---

### P2.3 — Fortalecer suite de tests del dominio

Problema:
- Algunos tests de hooks están desalineados y no cubren escenarios críticos reales.

Entregables:
- Suite robusta para: import deep link, persistencia theme keys, apply/install, fallback/errores.

Tareas técnicas:
- [x] 1. Reescribir tests de `useTheme/useColors` con contrato real.
- [x] 2. Añadir tests de import y sync de settings.
- [x] 3. Añadir smoke tests de endpoints themes clave.

Criterios de aceptación:
- [x] Cobertura de rutas críticas de tema con casos felices + error.

Estimación: 1.5–3 días
Riesgo: Bajo
Dependencias: P0.1, P1.2

Estado P2.3: ✅ COMPLETADO

Estado Fase P2: ✅ COMPLETADA

---

## 4) Backlog ticketable (formato directo)

- THEME-001 (P0): Implementar importador deep link `irontrain://share/theme/:slug`.
- THEME-002 (P0): Resolver contrato `publish` (implementar o retirar y alinear docs/tests).
- THEME-003 (P1): Registrar install/apply móvil contra `/api/social/themes/:id/install`.
- THEME-004 (P1): Tipado fuerte y política de sync para keys `theme_studio_*`.
- THEME-005 (P1): Alinear `userInterfaceStyle` con comportamiento de `themeMode=system`.
- THEME-006 (P2): Migración DB con constraints/enums para dominio themes.
- THEME-007 (P2): Migración off legacy theming (`Themed.tsx`, `constants/Colors.ts`).
- THEME-008 (P2): Refuerzo de tests dominio themes (app + api + sync).

---

## 5) Plan de sprints sugerido

Sprint A (P0)
- THEME-001
- THEME-002

Sprint B (P1)
- THEME-003
- THEME-004
- THEME-005

Sprint C (P2 + calidad)
- THEME-006
- THEME-007
- THEME-008

---

## 6) Riesgos y mitigaciones

1. Riesgo: romper apply de tema en producción.
- Mitigación: feature flag para import flow + rollout por porcentaje interno.

2. Riesgo: inconsistencias por datos legacy en constraints DB.
- Mitigación: pre-migración de saneamiento + dry-run en staging.

3. Riesgo: métricas duplicadas de install/apply.
- Mitigación: idempotencia por usuario/theme/version en backend.

4. Riesgo: regresión UX en settings/theme studio.
- Mitigación: checklist manual multi-dispositivo y pruebas de navegación.

---

## 7) Checklist de salida (GA tema robusto)

- [x] Deep link de tema importa y aplica correctamente.
- [x] Contrato API y docs sin desalineaciones.
- [x] Installs/applies reflejan uso móvil real.
- [x] Política local/sync de claves de tema documentada y aplicada.
- [x] DB endurecida para estados inválidos.
- [x] Componentes legacy de tema removidos o aislados.
- [x] Tests críticos de tema en verde.
- [x] Runbook actualizado para incidentes del dominio themes.

---

## 8) Criterio de “listo para ejecutar”

Este plan queda ejecutable desde hoy con backlog ticketable, orden de implementación, riesgos, dependencias y criterios de aceptación verificables por fase.
