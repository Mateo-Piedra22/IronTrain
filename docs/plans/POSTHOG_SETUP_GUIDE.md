# Guía de Configuración PostHog para IronTrain (Post-Migración)

Esta guía detalla el estado actual de la integración con PostHog tras la migración desde los sistemas "custom" de IronTrain, y los pasos manuales que debes realizar en tu dashboard de PostHog para que todo funcione correctamente.

## 1. Lo que ya está funcionando (Configurado en código)

El código de la aplicación y el website ya están preparados para enviar y recibir datos de PostHog:

- **Autocapture de Eventos**: El ciclo de vida de la app, pantallas vistas y eventos básicos de interacción ya se están capturando gracias a `captureAppLifecycleEvents: true` en la inicialización.
- **Identificación de Usuarios**: Cuando un usuario inicia sesión, su ID y propiedades se envían a PostHog (`posthog.identify()`), vinculando toda su actividad.
- **Feedback y Reportes de Bugs**: La pantalla de feedback de la app ahora envía un evento custom llamado `user_feedback`.
  - *Propiedades adjuntas*: `message`, `feedbackType` (bug, feature_request, review, other), `appVersion`, `appBuild`, `platform`, `osVersion`, `deviceModel`, `context`, `subject`, `contactEmail`.
- **Modo Mantenimiento y Offline**: La aplicación está escuchando activamente las Feature Flags `maintenance-mode` y `offline-mode` a través del hook `useFeatureFlagEnabled` en el componente `MaintenanceGuard.tsx` y `MaintenanceMode.tsx`.
- **Notificaciones (Surveys/Banners)**: El código fuente del admin web ahora redirige a los paneles de PostHog para gestionar Banners (vía Feature Flags con payload JSON) y Popups/Modales (vía PostHog Surveys).

---

## 2. Lo que DEBES configurar manualmente en PostHog

Para que la app reaccione correctamente y puedas visualizar los datos, debes ingresar a tu [Dashboard de PostHog](https://us.posthog.com/project/347728) y realizar las siguientes acciones:

### A. Crear las Feature Flags de Control Global

Estas flags controlan si la app está en mantenimiento o sin conexión a la base de datos (offline).

1. [x] Ve a **Feature Flags** en el menú izquierdo de PostHog.
2. [x] Haz clic en **New feature flag**.
3. [x] **Modo Mantenimiento:**
   - **Key**: `maintenance-mode`
   - **Description**: Activa la pantalla de bloqueo total por mantenimiento.
   - **Release condition**: Ponlo en 0% (Desactivado). Cuando quieras mantenimiento, súbelo al 100%.
   - *(Opcional)* Payload: Puedes agregar un JSON payload como `{"message": "Estamos mejorando los servidores"}` si quieres mostrar un mensaje custom (requiere actualización menor en el frontend para leerlo, actualmente muestra un mensaje genérico).
   - Guarda la flag.
4. [x] **Modo Offline Forzado:**
   - Haz clic en **New feature flag** nuevamente.
   - **Key**: `offline-mode`
   - **Description**: Fuerza a la app a no intentar sincronizar con Neon/Backend.
   - **Release condition**: Ponlo en 0% (Desactivado).

### B. Crear el Dashboard de "Feedback de Usuarios"

Dado que eliminamos el panel de moderación custom en la web de admin, necesitas un lugar para leer lo que los usuarios reportan.

1. Ve a **Dashboards** -> **New dashboard** -> **Blank dashboard**.
2. Nómbralo "Feedback de la Comunidad".
3. Haz clic en **Add insight**.
4. En la configuración del insight (Trends o Data table):
   - Selecciona el evento: `user_feedback`
   - Selecciona la visualización: **Data table** (Tabla de datos).
   - Edita las columnas de la tabla para mostrar:
     - Person (Usuario)
     - Time (Fecha)
     - Event Property: `feedbackType`
     - Event Property: `message`
     - Event Property: `contactEmail`
     - Event Property: `deviceModel`
5. Guarda el insight en el dashboard.
6. **Session Replays (Magia de PostHog):** En esta tabla, cada fila (evento de feedback) tendrá un botón de "Play" para ver la grabación de pantalla del usuario justo antes de que enviara el reporte de bug. ¡Asegúrate de tener habilitado "Session Replay" en los settings de tu proyecto de PostHog!

### C. Crear el Dashboard de "Uso y Dispositivos" (Reemplazo de `/api/metrics/install`)

1. En tu Dashboard principal (o uno nuevo llamado "Métricas Core"), agrega un nuevo Insight.
2. Usa el evento predeterminado `$pageview` o `$screen` (dependiendo de si ves la web o la app).
3. Agrupa (Breakdown) por **Event Property**: `$os` (para ver iOS vs Android vs Windows).
4. Crea otro insight contando "Unique persons" (DAU / MAU) para reemplazar el contador básico que tenías en el admin web.

### D. Configurar Anuncios / Popups (Reemplazo de `admin_notifications`)

Cuando necesites enviar un aviso a los usuarios ("Nueva versión", "Encuesta de satisfacción", etc.):

**Para Popups / Modales Intrusivos:**
1. Ve a **Surveys** en PostHog.
2. Crea una nueva encuesta (New survey).
3. PostHog te permite crear encuestas tipo "Popover" o "Modal".
4. Configura el mensaje y a quién se le muestra (ej: usuarios activos en los últimos 7 días).
5. PostHog se encarga de mostrarlo una sola vez por usuario.

**Para Banners No Intrusivos:**
1. Ve a **Feature Flags**.
2. Crea una flag (ej: `banner-black-friday`).
3. En **Payload**, pon el JSON con el texto del banner: `{"title": "Descuento 50%", "url": "..."}`.
4. En el código de la app, deberás leer esta flag (ej: `useFeatureFlagPayload('banner-black-friday')`) y renderizar el banner si existe.

---

## 3. Verificación Final

1. Abre la aplicación móvil en tu simulador o dispositivo.
2. Ve a la pantalla de **Feedback** y envía un reporte de prueba.
3. Ve a PostHog -> **Activity** -> **Events** y busca el evento `user_feedback`. Si aparece con tus comentarios, la migración fue un éxito.
4. En PostHog, ve a **Feature Flags**, activa `maintenance-mode` (ponlo al 100%).
5. Recarga la aplicación. Debería mostrar la pantalla de bloqueo roja de "Mantenimiento". Desactívalo en PostHog y la app volverá a la normalidad.

¡Con esto, has reducido significativamente el código de tu backend, el costo de base de datos y has ganado herramientas de analítica empresarial!