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

### Configuración de Firebase (Mobile)
Debido a la política de Zero-Trust, `google-services.json` (Android) y `GoogleService-Info.plist` (iOS) están en el `.gitignore`. Para que los builds funcionen en GitHub Actions y EAS:

1. **Codificar archivos a Base64** (ejecutar localmente):
   - Android: `[System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes("./google-services.json")) | clip` (Windows PowerShell)
   - iOS: `[System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes("./GoogleService-Info.plist")) | clip` (Windows PowerShell)
2. **Cargar en GitHub Secrets**:
   - `ANDROID_GOOGLE_SERVICES_JSON_BASE64`
   - `IOS_GOOGLE_SERVICES_INFO_PLIST_BASE64`
3. **Cargar en EAS Secrets** (para builds de EAS independientes):
   - `ANDROID_GOOGLE_SERVICES_JSON_BASE64`
   - `IOS_GOOGLE_SERVICES_INFO_PLIST_BASE64`
   - El script `eas-build-pre-install` los restaurará automáticamente en el servidor de build.

---

## Paso 1 - Definición de Versión Semántica

IronTrain utiliza [Semantic Versioning](https://semver.org/).
Ejemplo de flujo: `2.0.0` -> `2.0.1` (Parche) o `2.0.0` -> `2.1.0` (Nueva Funcionalidad).

---

## Paso 2 - Preparación de la Versión (Automatizado)
 
 Ejecutar en la raíz del proyecto:
 `npm run audit` (Verificar integridad del proyecto)
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
1. Auditoría automática del proyecto.
2. Conversión de `Unreleased` a la fecha actual (`YYYY-MM-DD`).
3. Creación preventivo del siguiente bloque `Unreleased`.
4. Regeneración automática de changelogs (JSON y Web).
5. La tabla `changelogs` en Neon se alinea automáticamente cuando se consulta `GET /api/changelogs` (upsert idempotente desde `docs/CHANGELOG.md`).

## Modelo Unificado de Changelog

- Fuente canónica: `docs/CHANGELOG.md`.
- App móvil: consume `GET /api/changelogs?includeUnreleased=1`, cachea localmente y usa `src/changelog.generated.json` como fallback offline.
- Website/API: sincroniza `docs/CHANGELOG.md` hacia tabla `changelogs` antes de responder.
- Reacciones: permanecen en DB (`changelog_reactions`) y se sincronizan por motor offline-first.

---

## Paso 5 - Commit y Despliegue de Código (Manual)
 
 Realice el commit de los archivos modificados (app.json, package.json, changelogs, etc.) y haga push a la rama principal. 
 Vercel detectará el cambio y actualizará el sitio web automáticamente.
 
 ---
 
 ## Paso 6 - Tagging y Build de Producción (Manual)
 
 Para disparar la construcción del APK y la publicación del release:
 `git tag v[VERSION]`
 `git push --tags`
 
 Esto activa el flujo de GitHub Actions que:
 - Ejecuta `eas build` para Android/iOS.
 - Lee el changelog desde `src/changelog.generated.json` y lo usa como notas del release.
 - Crea el Release en GitHub con el tag correspondiente y el contenido detallado del changelog.
 - Sube el binario (`.apk`) y el archivo de sumas de verificación (`sha256`).

---

### Promover a Staging (Controlado)

Para evitar builds automáticos de `master` que promuevan cambios a `staging`, el proceso de promoción está controlado por dos mecanismos:

- Trigger manual: usa el workflow de `Promote Android Build to Staging` desde la pestaña **Actions** → selecciona el workflow y pulsa **Run workflow** (este requiere la aprobación del Environment `staging`).
- Trigger por commit: incluye la cadena `[promote]` en el mensaje del commit que quieras promover (por ejemplo: `chore: finish release 2.2.0 [promote]`). Si se detecta esa cadena en el `head_commit.message`, el workflow de promoción se ejecutará automáticamente y respetará las reglas del Environment `staging`.

Uso recomendado:
- Para despliegues controlados y revisados, ejecuta manualmente el workflow (`workflow_dispatch`).
- Si necesitas automatizar una promoción por push, marca explícitamente el commit con `[promote]`.

Ejemplo de commit para promover desde la rama `master`:
```
git commit -m "chore: release 2.2.1 [promote]"
git push origin master
```

Nota de seguridad: la promoción a `staging` seguirá sometida a las reglas de protección del Environment (revisores, restricciones de quién puede desplegar, etc.).
 
 ---
 
 ## OPCIÓN RECOMENDADA: Publicación Total (One-Click)
 
 Para automatizar todo el ciclo anterior (audit, commit, tagging y push) en un solo comando:
 `npm run deploy:mobile`
 
 Este comando ejecutará internamente:
 1. `npm run audit` (Verificación de integridad).
 2. `git commit` automático de los cambios de versión.
 3. `git tag` con la versión actual de `app.json`.
 4. `git push` de la rama y los tags hacia GitHub.
 
 Al finalizar el push, **GitHub Actions** detectará el nuevo tag y disparará automáticamente la build en EAS a través del flujo `release-android.yml`.

 ---
 ## AUXILIAR: En caso de build/tests fallidos en Github
 1. Ejecuta el siguiente comando para eliminar el tag de tu máquina: `git tag -d vx.x.x`
 2. Ejecuta el siguiente comando para eliminar el tag de Github: `git push origin --delete vx.x.x`

 ---
 
 ## 🚧 OPCIÓN DE EMERGENCIA: Despliegue de Hotfix (Local Build)
 
 Si necesitas desplegar una corrección crítica (**hotfix**) y no puedes esperar a la cola de EAS Cloud, utiliza este flujo local. Esto compilará el APK en tu máquina usando los certificados oficiales de producción.
 
 ### Requisitos en tu máquina:
 1.  **Java JDK 17+** y Android SDK instalados.
 2.  **eas-cli** instalado y logueado (`eas login`).
 3.  **GitHub CLI (gh)** instalado y logueado (`gh auth login`).
 
 ### Comando:
 `npm run deploy:hotfix`
 
 ### ¿Qué hace internamente?
 1.  **Auditoría**: Ejecuta `audit` para asegurar integridad.
 2.  **Commit & Tag**: Realiza el commit (con `[skip eas]`) y el tagging de la versión actual.
 3.  **Push**: Sube el código y el tag a GitHub.
 4.  **Construcción Local**: Llama a `eas build --local` usando tus credenciales de producción.
 5.  **Publicación Directa**: Usa `gh` para crear el Release y subir el APK a GitHub de forma inmediata.
 
 *Nota: Al igual que el comando One-Click, este comando asume que ya ejecutaste el **Paso 4 (release:finalize)**.*
 
 ---
 
 ## 🛠️ Herramientas de Desarrollo: Builds Locales (Solo Binarios)
 
 Si solo necesitas el archivo `.apk` o `.aab` para testing manual o enviárselo a alguien, sin disparar procesos de Git ni publicar en GitHub, utilizá estos comandos.
 
 ### Android (Local Build via WSL)
 Estos comandos automatizan la restauración de secretos y usan **WSL** internamente. Son ideales para generar binarios rápidos y gratuitos.
 
 - **Generar APK (Instalable directo)**:
   ```powershell
   npm run build:android:apk
   ```
 - **Generar App Bundle (Para la Store)**:
   ```powershell
   npm run build:android:aab
   ```
 
 ### iOS (Cloud Build)
 Como estás en Windows, la build local no es posible. Usá este comando para compilar en la nube:
 
 - **Generar Build de Test**:
   ```powershell
   npm run build:ios:preview
   ```
 
 ---
 
 ### Resumen de Flags Útiles:
 - `--local`: Compila usando tu CPU (WSL en Windows). Gratis e ilimitado.
 - `--profile preview`: Usa configuración de producción pero genera un APK instalable.
 - `--profile production`: Genera el archivo final para tiendas (App Bundle).
 - `--non-interactive`: Evita que EAS te haga preguntas durante el proceso.
 
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
