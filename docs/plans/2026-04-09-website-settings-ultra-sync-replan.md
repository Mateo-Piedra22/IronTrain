# Replanteo `/settings` Website (ultra-sync, sin solapar `Seguridad de cuenta`)

Fecha: 2026-04-09
Estado: Propuesta ejecutable (sin implementación aún)
Owner sugerido: Website + Sync Core

---

## 1) Contexto y problema real

En el perfil web del usuario dueño (`/user/[username]`) existe un botón **"Ajustes app"** que navega a `/settings`, pero esa ruta base no existe actualmente (solo existe `/settings/delete-account`).

Evidencia técnica:

- Botón existente: `website/app/(marketing)/user/[username]/page.tsx` (`href="/settings"`).
- Ruta inexistente: en `website/app/settings/` no hay `page.tsx`; solo `delete-account/page.tsx`.
- `Seguridad de cuenta` ya está cubierto extensamente por `website/app/auth/account/page.tsx` (auth, sesiones, password, privacidad/export, desactivar y eliminar cuenta).

Conclusión: no conviene eliminar el botón. Conviene **darle propósito distinto y claro** respecto de `Seguridad de cuenta`.

---

## 2) Distinción de dominios (decisión de producto)

Para evitar duplicidad/confusión:

### A) `/auth/account` (YA existe, mantener)

**Dominio:** identidad, autenticación, seguridad y acciones de riesgo.

Incluye (hoy):

- credenciales, link/unlink providers,
- sesiones,
- desactivar/eliminar cuenta,
- export y temas de privacidad de cuenta.

### B) `/settings` (NUEVO propósito)

**Dominio:** preferencias funcionales de uso de producto + sincronización de configuración entre dispositivos.

No debe incluir:

- password,
- sesiones,
- eliminación/desactivación,
- providers OAuth.

### C) `/profile` / `/user/[username]`

**Dominio:** presencia social y datos públicos.

---

## 3) Hallazgos de sincronización (clave para “ultra sincronizado”)

### 3.1 El sistema ya sincroniza la tabla `settings`

- `settings` está en contrato de sync (`SyncProtocol` web y mobile).
- `sync/push`, `sync/pull`, `sync/snapshot` manejan `settings` explícitamente.

### 3.2 Regla actual de scoping de keys

- En cloud/web se usa prefijo por usuario para `settings.key`: `${userId}:${key}`.
- En mobile/local se opera mayormente sin prefijo.
- `pull`/`snapshot` hacen unscoping para cliente; `push` vuelve a scopear.

### 3.3 Riesgo actual de inconsistencia

Hay consultas de `settings` por key sin normalizar estrictamente el scoping en todos lados (ej. lectura de `weightUnit` en compare social), lo que puede causar drift según origen de datos histórico.

### 3.4 Conclusión técnica

`/settings` puede y debe construirse sobre la tabla `settings`, pero con **contrato canónico explícito de keys** (qué synca global, qué es local-only, qué es técnico-interno).

---

## 4) Qué debe ser `/settings` (sin pisar seguridad)

## Opción recomendada (A): "App Preferences + Sync"

Un hub de preferencias de uso con persistencia cloud coherente y telemetría de estado de sync.

Contenido recomendado (MVP):

1. **Unidad de peso** (`weightUnit`) — shared cross-device.
2. **Días de entrenamiento** (`training_days`) — shared cross-device.
3. **Estado de sincronización de configuración** (último sync, checksum/status básico).
4. CTA clara a `Seguridad de cuenta` para temas de auth/credenciales.

Por qué esta opción:

- Reusa sistemas reales existentes (tabla/settings + sync APIs + ConfigService).
- Evita duplicar `auth/account`.
- Entrega valor real en web aunque el core producto sea app móvil.

## Alternativa B: "Solo hub de navegación"

- Página con links a secciones existentes y sin edición real.
- Rápida pero aporta poco valor y no resuelve expectativa de “Ajustes app”.

## Alternativa C: "Clon parcial de settings mobile"

- Copiar la pantalla mobile en web.
- No recomendado: muchas preferencias son device-local y se vuelve inconsistente.

---

## 5) Política de claves para ultra-sync (propuesta formal)

## 5.1 Taxonomía de keys

### Tier 1 — `cloud_shared` (editar en `/settings` web)

- `weightUnit`
- `training_days`
- (futuro evaluable) `language` si se decide unificar idioma entre clientes

### Tier 2 — `device_local` (NO editar en web)

- timers y estados efímeros del workout/timer,
- flags de feedback háptico/sonido dependientes de hardware,
- cualquier key operativa que hoy deba permanecer local-only.

### Tier 3 — `internal_technical` (ocultas, no UI)

- cursores de sync,
- claves de mantenimiento/diagnóstico,
- metadata técnica no orientada a usuario.

## 5.2 Reglas canónicas

1. **Cloud siempre almacenado scoped**: `${userId}:${key}`.
2. **Cliente consume key unscoped**.
3. Helpers únicos de scoping/unscoping compartidos por endpoints.
4. Consultas de lectura deben tolerar legacy de forma controlada durante transición.

---

## 6) Contrato funcional de `/settings` (MVP)

## 6.1 UX mínima

- Header: `Ajustes App`.
- Sección “Preferencias sincronizadas”.
- Sección “Sincronización” (estado y recomendaciones).
- Sección “Cuenta” con link a `/auth/account`.

## 6.2 APIs (propuestas)

### GET `/api/settings/app`

Devuelve:

- `weightUnit`
- `trainingDays`
- `syncSummary` (si disponible)
- `sourceOfTruth` metadata (opcional)

### PUT `/api/settings/app`

Permite actualizar únicamente keys `cloud_shared` validadas.

Validaciones:

- `weightUnit` en `kg|lbs`.
- `trainingDays` array int [0..6], deduplicado, 1..7.

## 6.3 Compatibilidad

- Durante transición, lectura tolerante de keys legacy sin scope.
- Escritura siempre canónica scoped.

---

## 7) Plan por fases (ejecutable)

## P0 — Corrección de ruta rota y separación de dominios

- Crear `website/app/settings/page.tsx` funcional (no placeholder vacío).
- Mantener botón `Ajustes app` apuntando a `/settings`.
- Mantener `Seguridad de cuenta` en `/auth/account`.

Criterio de salida:

- No existe navegación a ruta vacía desde perfil owner.

## P1 — MVP de preferencias sincronizadas

- Implementar lectura/escritura de `weightUnit` + `training_days` vía API de settings o endpoints existentes.
- Mostrar feedback de guardado y errores de validación/rate-limit.

Criterio de salida:

- Cambio en web persiste y aparece en pull/snapshot mobile sin intervención manual adicional.

## P2 — Endurecimiento de contrato de keys

- Introducir helper canónico de keys settings (scope/unscoped) en backend web.
- Revisar queries sueltas de `settings` para usar helper y fallback legacy.
- Corregir rutas con riesgo de inconsistencia de scoping.

Criterio de salida:

- Sin lecturas ambiguas de keys en endpoints críticos.

## P3 — Observabilidad y QA de sincronización

- Instrumentar eventos: `settings_update_requested|applied|rejected`, `settings_sync_drift_detected`.
- Añadir tests de contrato (API + sync push/pull/snapshot para settings).
- Checklist manual web→mobile y mobile→web.

Criterio de salida:

- Drift de settings detectado y tasa de error controlada.

---

## 8) Riesgos y mitigaciones

1. **Duplicar conceptos con `/auth/account`**
   - Mitigación: frontera de dominio explícita (auth/security vs app prefs).

2. **Drift por scoping inconsistente**
   - Mitigación: helper único + tests + fallback legacy temporal.

3. **Editar en web keys que deberían ser local-only**
   - Mitigación: allowlist estricta (`cloud_shared`) en API.

4. **Expectativa de “todo settings de mobile en web”**
   - Mitigación: comunicar qué preferencias son cross-device y cuáles dependen del dispositivo.

---

## 9) Matriz de aceptación “ultra-sync”

1. Web cambia `weightUnit` -> mobile refleja valor tras sync normal.
2. Mobile cambia `training_days` -> web refleja valor en próxima carga.
3. Snapshot restore conserva keys `cloud_shared` sin duplicados ni prefijos visibles en cliente.
4. Ninguna key `device_local` aparece editable en `/settings` web.
5. `/auth/account` y `/settings` no comparten acciones destructivas ni auth-sensitive.

---

## 10) Decisión recomendada

Implementar **Opción A (App Preferences + Sync)** con fases P0→P3.

Resumen ejecutivo:

- No quitar el botón.
- No mezclar con `Seguridad de cuenta`.
- Hacer de `/settings` el lugar de preferencias funcionales sincronizadas cross-device.
- Endurecer contrato de keys para coherencia real web↔móvil.
