# Plan de Migración y Optimización hacia PostHog / Sistemas Modernos

Actualmente, IronTrain cuenta con varios sistemas desarrollados de manera "custom" (a medida) tanto en la aplicación móvil como en el panel de administración web. Estos sistemas cumplen su función, pero mantienen deuda técnica, escalan mal en bases de datos relacionales y son ineficientes comparados con herramientas especializadas como PostHog.

A continuación, presento un análisis profundo de los sistemas actuales detectados en el código y un plan de acción técnico para delegar responsabilidades, reducir código y mejorar la experiencia.

---

## 1. Sistema de Feedback y Reporte de Errores

### Estado Actual
- **App:** Pantalla custom (`app/feedback.tsx`) que envía peticiones al backend a través de `MetricsAndFeedbackService.ts`.
- **Backend:** Endpoint (`api/feedback/route.ts`) que procesa el texto, recolecta la IP, User Agent, versión de la app y guarda todo en la tabla `feedback` de PostgreSQL/Drizzle.
- **Admin Web:** El panel de moderación (`CommunityModerationPanel.tsx`) lee esta tabla para mostrar los reportes.

### Problemas
- Mantener la UI de la tabla en el admin web es tedioso.
- No hay forma de responder al usuario fácilmente ni de atar el error a una grabación de sesión (Session Replay) para entender *qué hizo* el usuario antes del bug.
- Consume espacio y recursos de I/O en la DB transaccional.

### Plan de Migración (PostHog)
1. **Reemplazo con PostHog Surveys (Feedback):** Utilizar las encuestas tipo "Feedback" de PostHog. PostHog permite crear encuestas flotantes (Popovers) nativas o usar su API para enviar feedback atado directamente a la sesión del usuario.
2. **Session Replays:** Al enviar el feedback vía PostHog, el reporte quedará automáticamente vinculado a la grabación de la pantalla del usuario en el momento exacto del error.
3. **Eliminación Técnica:** 
   - Eliminar `api/feedback/route.ts`.
   - Eliminar tabla `feedback` de Drizzle.
   - Eliminar `MetricsAndFeedbackService.submitFeedback`.
   - Añadir un link directo a las encuestas de PostHog en el panel de administración web.

---

## 2. Sistema de Mantenimiento y Control Global (System Status)

### Estado Actual
- **Base de datos:** Tabla `system_status` (id='global') con columnas `maintenance_mode` y `offline_only_mode`.
- **Backend:** `lib/system-status.ts` que valida en cada endpoint (`validateSystemAccess`) si el sistema está caído, devolviendo 503.
- **Admin Web:** Formularios complejos en `SystemStatusPanel.tsx` para hacer "toggles" de estas banderas en la base de datos.
- **App:** `MaintenanceMode.tsx` que envuelve la app.

### Problemas
- Hacer un toggle en el panel web hace un UPDATE a la base de datos, invalidando cachés de Next.js y forzando sincronizaciones complejas.
- Requiere UI hecha a medida y lógica de confirmación pesada en `admin/actions/system.ts`.

### Plan de Migración (PostHog Feature Flags)
1. **Mantenimiento Instantáneo:** Mover `maintenance_mode` y `offline_only_mode` a Feature Flags de PostHog (`maintenance-mode`, `offline-mode`).
2. **Payloads Dinámicos:** Usar los JSON payloads de las flags para mandar el `message` (el motivo del mantenimiento) sin tocar la DB.
3. **Eliminación Técnica:**
   - Eliminar tabla `system_status` de Drizzle.
   - Eliminar lógica de `getSystemStatus()` y `validateSystemAccess()`.
   - Reemplazar el formulario de `SystemStatusPanel.tsx` por un iframe embebido del dashboard de PostHog o un simple link a la sección de Feature Flags.

---

## 3. Sistema de Notificaciones Administrativas (Banners / Avisos)

### Estado Actual
- **Backend:** Tabla `admin_notifications` y logs de lectura en `notification_logs`. Endpoint complejo (`api/notifications/route.ts`) que filtra por versión, plataforma y segmento de usuario (activo, inactivo, nuevo).
- **App:** Un servicio custom para leer estas notificaciones y mostrarlas como popups o modales.

### Problemas
- La lógica de segmentación está hardcodeada (ej. `lastWorkout < 14 days` para inactivos). Si queremos cambiar la regla, hay que hacer un deploy del backend.
- Riesgo de cuellos de botella por el chequeo constante de "visto/no visto" (`notification_logs`).

### Plan de Migración (PostHog Feature Flags & Surveys)
1. **Banners Informativos:** Utilizar **PostHog Feature Flags** con payloads JSON para los avisos no intrusivos. Se puede crear una flag `show-announcement-banner` con segmentación visual desde el panel de PostHog (ej. "Usuarios que no han abierto la app en 7 días"). 
2. **Popups/Modales:** Utilizar **PostHog Surveys** configuradas para mostrarse una sola vez. PostHog maneja automáticamente el estado de "visto" y el capping sin tocar nuestra DB.
3. **Eliminación Técnica:** Adiós a las tablas `admin_notifications`, `notification_logs` y los endpoints de `/api/notifications/`.

---

## 4. Métricas de Instalación y Uso de Dispositivos

### Estado Actual
- **App:** `MetricsAndFeedbackService.trackInstallIfNeeded` genera un ID al azar y lo envía a `/api/metrics/install`.
- **Admin Web:** `SystemStatusPanel.tsx` muestra un recuento estático de `metrics.installs`.

### Problemas
- Reinventar la rueda. Estamos guardando metadatos del dispositivo (OS, Modelo, Versión) manualmente en una tabla de PostgreSQL.

### Plan de Migración (PostHog Auto-Capture & Properties)
1. **User Properties Automáticas:** PostHog ya captura automáticamente la versión de la app, el SO y el modelo del dispositivo.
2. **Eliminación Técnica:**
   - Borrar `api/metrics/install`.
   - Borrar `MetricsAndFeedbackService.trackInstallIfNeeded`.
   - Dejar de rastrear el `INSTALL_TRACKED_KEY` en el SecureStore local. Las instalaciones y DAU (Daily Active Users) se deben leer directamente desde los dashboards de PostHog.

---

## 5. Analíticas de "Vistas" (Activity Seen / Changelog)

### Estado Actual
- Tablas como `activity_seen` y llamadas a endpoints como `/api/notifications/log` para registrar si el usuario vio un changelog.

### Problemas
- Guardar analíticas (series de tiempo / logs) en una base de datos relacional (PostgreSQL) es un anti-patrón de escalabilidad.

### Plan de Migración (PostHog Events & Cohorts)
1. **Eventos Nativos:** Cualquier evento de "Visto" (ej. `changelog_viewed`, `notification_dismissed`) será un simple `analytics.capture('event_name')`.
2. **Excepción (Inbox Social):** Los "vistos" del inbox social (`SocialService.markAllAsSeen`) sí deben mantenerse en la DB porque dictan la lógica de negocio inmediata (borrar el puntito rojo del chat), pero la estadística pura de visualizaciones debe ir a PostHog.

---

## 6. Resumen de Acción y Ejecución

### Fase 1: Limpieza de Métricas Estáticas (Fácil)
- [ ] Eliminar rastreo custom de instalaciones (`/api/metrics/install`).
- [ ] Asegurar que `analytics.ts` capture los eventos del ciclo de vida (`captureAppLifecycleEvents`).
- [ ] Crear el primer dashboard en PostHog para DAU, MAU e Instalaciones.

### Fase 2: Migración de Mantenimiento y Feature Flags (Medio)
- [ ] Crear flags `maintenance-mode` y `offline-mode` en PostHog.
- [ ] Refactorizar `MaintenanceMode.tsx` en la app para leer estas flags.
- [ ] Eliminar tabla `system_status` y limpiar el panel web.

### Fase 3: Migración de Feedback y Notificaciones Admin (Avanzado)
- [ ] Reemplazar el formulario de la app (`app/feedback.tsx`) para usar la API o widget de PostHog Surveys.
- [ ] Eliminar endpoints de `/api/feedback` y `/api/notifications`.
- [ ] Borrar tablas `feedback`, `admin_notifications` y `notification_logs`.
- [ ] Instruir a los administradores a enviar comunicados usando PostHog Popovers.


IMPORTANTE: CRITICAR, AMPLIAR, MEJORAR, OPTIMIZAR, DOCUMENTAR Y LUEGO IMPLEMENTAR SON LOS PILARES OBLIGATORIOS A SEGUIR.
SIEMPRE CONSIDERAR QUE POSIBLEMENTE TENER QUE TRABAJAR EN APP Y WEBSITE, EN FRONTEND, BACKEND, DBS, ETC DE CADA UNO.


Recomendaciones y Puntos Ciegos a Considerar ⚠️

Aunque el plan es sólido, te sugiero tener en cuenta estos detalles técnicos durante la implementación:
1. Manejo del estado Offline (Feature Flags)

Mencionas mover maintenance-mode y offline-mode a PostHog.

    El riesgo: ¿Qué pasa si el usuario abre la app sin conexión a internet o con muy mala señal? Si la app depende de PostHog para saber si debe mostrar la pantalla de mantenimiento, podría quedarse "colgada" esperando la respuesta.

    Solución: Asegúrate de implementar un timeout muy corto al consultar las flags de PostHog en el inicio de la app, y define valores de respaldo (fallbacks) por defecto usando el almacenamiento local o la caché de PostHog.

2. Privacidad y Datos Sensibles en Session Replays

    Al habilitar grabaciones de pantalla, PostHog capturará la UI de la app. Si IronTrain maneja datos de salud, peso, correos o contraseñas, debes asegurarte de enmascarar (masking) esos campos en la configuración del SDK de PostHog para evitar problemas legales y de privacidad.

    También tendrás que actualizar los Términos y Condiciones / Política de Privacidad de la app para reflejar este nuevo rastreo.

3. Ad-Blockers y DNS Filters (Pi-Hole, AdGuard)

    Muchos usuarios (especialmente en web y Android) usan bloqueadores que filtran peticiones a dominios de analíticas (incluyendo la nube de PostHog).

    Si dependes de PostHog para reglas críticas de negocio (como el modo mantenimiento), estos usuarios podrían saltarse tus bloqueos.

    Solución: Para máxima fiabilidad, configura un Proxy Inverso (Reverse Proxy) en tu backend de Next.js (ej. en /ingest) que redirija el tráfico a PostHog, de modo que las peticiones parezcan tráfico de primera parte (first-party) y no sean bloqueadas.
