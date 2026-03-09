# Publicar una Nueva Versión (Guía Definitiva)

Esta guía documenta el proceso estricto para realizar el despliegue de una nueva versión de IronTrain. Se basa en una política de Zero-Trust y automatización para garantizar la integridad de los datos y la consistencia entre la App, la Web y el Backend.

## Objetivo
Al finalizar este proceso, se habrán cumplido los siguientes hitos:
- APK publicado y firmado en GitHub Releases (descargable).
- Website actualizado (Sección de Descargas y Changelog).
- API de Sincronización preparada para la nueva versión.
- Sistema de Actualización In-App notificando a los usuarios con el link de descarga directo.

---

## Paso 0 - Requisitos Previos (Configuración Unica)

### Infraestructura de Build (GitHub Actions)
- Configurar el Secret `EXPO_TOKEN` en el repositorio de GitHub para permitir que las Actions ejecuten builds con EAS.
  - Generar token en: Expo Dashboard > Settings > Access Tokens.
  - Guardar en: GitHub > Repo > Settings > Secrets and variables > Actions > `EXPO_TOKEN`.

### Infraestructura de Hosting (Vercel)
- Directorio Raíz: `website`
- Variables de Entorno Críticas:
  - `DATABASE_URL`: Conexión string de Neon Database.
  - `NEON_AUTH_COOKIE_SECRET`: Secreto para verificación de JWT de IronSocial.
  - `NEXT_PUBLIC_NEON_AUTH_URL`: URL del proveedor de autenticación.
  - `GITHUB_RELEASES_OWNER` / `REPO` / `TOKEN`: Para la sincronización de releases.
  - `FIREBASE_PRIVATE_KEY` y asociados: Para el envío de notificaciones Push (FCM).

---

## Paso 1 - Definición de Versión Semántica

IronTrain utiliza [Semantic Versioning](https://semver.org/).
Ejemplo de flujo: `2.0.0` -> `2.0.1` (Parche) o `2.0.0` -> `2.1.0` (Nueva Funcionalidad).

---

## Paso 2 - Preparación de la Versión (Automatizado)

Ejecutar en la raíz del proyecto:
`npm run release:prepare -- [VERSION]`
Ejemplo: `npm run release:prepare -- 2.0.1`

Este comando sincroniza automáticamente:
- `app.json` (Version y Build Number).
- `package.json` (Metadata del paquete).
- `docs/CHANGELOG.md` (Fuente única de verdad del changelog).
- `src/changelog.generated.json` (JSON estático de fallback para la App).
- `website/content/CHANGELOG.md` (Copia para fallback web y builds).

---

## Paso 3 - Redacción del Changelog (Manual)

Edite el archivo `docs/CHANGELOG.md`. 
En la sección `## [VERSION] (Unreleased)`, describa los cambios realizados siguiendo el formato técnico establecido:
- Utilice bullets claros.
- Resalte el componente afectado en negrita (ej: **Sync Engine**, **IronSocial**).
- No utilice placeholders ni información genérica.

---

## Paso 4 - Cierre del Release (Automatizado)

Una vez verificado el contenido del changelog:
`npm run release:finalize`

Este paso realiza:
1. Conversión de `Unreleased` a la fecha actual (`YYYY-MM-DD`).
2. Creación preventivo del siguiente bloque `Unreleased`.
3. Regeneración de `src/changelog.generated.json`.
4. Sincronización final de `website/content/` para asegurar que el despliegue en Vercel incluya la información actualizada.
5. La tabla `changelogs` en Neon se alinea automáticamente cuando se consulta `GET /api/changelogs` (upsert idempotente desde `docs/CHANGELOG.md`).

## Modelo Unificado de Changelog

- Fuente canónica: `docs/CHANGELOG.md`.
- App móvil: consume `GET /api/changelogs?includeUnreleased=1`, cachea localmente y usa `src/changelog.generated.json` como fallback offline.
- Website/API: sincroniza `docs/CHANGELOG.md` hacia tabla `changelogs` antes de responder.
- Reacciones: permanecen en DB (`changelog_reactions`) y se sincronizan por motor offline-first.

---

## Paso 5 - Commit y Despliegue de Código

Realice el commit de los archivos modificados (app.json, package.json, changelogs, etc.) y haga push a la rama principal. 
Vercel detectará el cambio y actualizará el sitio web automáticamente.

---

## Paso 6 - Tagging y Build de Producción

Para disparar la construcción del APK y la publicación del release:
`git tag v[VERSION]`
`git push --tags`

Esto activa el flujo de GitHub Actions que:
- Ejecuta `eas build` para Android/iOS.
- Lee el changelog desde `src/changelog.generated.json` y lo usa como notas del release.
- Crea el Release en GitHub con el tag correspondiente y el contenido detallado del changelog.
- Sube el binario (`.apk`) y el archivo de sumas de verificación (`sha256`).

---

## Paso 7 - Verificación Final (Checklist)

### GitHub Releases
- Confirmar que el Release `v[VERSION]` existe y contiene el archivo APK.

### Website Check
- Verificar que `https://irontrain.motiona.xyz/downloads` muestra la nueva versión.
- Verificar que `https://irontrain.motiona.xyz/releases.json` devuelve el JSON correcto con la versión `latest`.
- Forzar sincronización de changelog a DB (solo admin autenticado):
  - Desde panel admin: `/admin` > sección `CHANGELOG_SYSTEM_MGMT` > botón `FORZAR_SYNC_DB`.
  - `POST https://irontrain.motiona.xyz/api/changelogs/sync`
  - Requiere JWT válido + usuario incluido en `ADMIN_USER_IDS`.
  - Respuesta esperada: `success: true` con `upsertedCount > 0` o `reason: "min_interval"`.

### App In-App Update
- Abrir la aplicación con una versión anterior.
- Confirmar que aparece el banner o modal de "Actualización Disponible".
- Verificar que el botón "Descargar" redirige correctamente a la página de descargas.

---
*Nota: Esta guía es de carácter mandatorio para mantener la integridad del ecosistema IronTrain.*
