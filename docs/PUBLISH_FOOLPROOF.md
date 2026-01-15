# Publicar una nueva versión (a prueba de tontos)

Esta guía asume que **ya probaste todo** y la build está lista.

## Objetivo
Al finalizar, vas a tener:
- APK publicado en GitHub Releases (descargable)
- Web actualizada (Descargas + Changelog)
- App avisando “Actualización disponible” y abriendo la descarga

---

## Paso 0 — Requisitos (una sola vez)
### En GitHub (Repo)
- Configurá el secret `EXPO_TOKEN` (para que GitHub Actions pueda buildear con EAS).

### En Vercel (Website)
- Root Directory: `website`
- Variables env:
  - `GITHUB_RELEASES_OWNER`
  - `GITHUB_RELEASES_REPO`
  - `GITHUB_RELEASES_TOKEN` (opcional)
- Importante: en Vercel, dejá **Output Directory vacío** (Next.js no usa `public` como output).

---

## Paso 1 — Elegí la versión
Ejemplo: `1.2.0`

Regla simple:
- Si es algo grande: subí minor (1.1.0 → 1.2.0)
- Si es fix: subí patch (1.1.0 → 1.1.1)

---

## Paso 2 — Preparar versión (automático)
En la raíz del repo:
- `npm run release:prepare -- 1.2.0`

Esto actualiza:
- `app.json` (versión de la app)
- `package.json` (versión del paquete)
- `docs/CHANGELOG.md` (crea/asegura `1.2.0 (Unreleased)`)
- `src/changelog.generated.json` (JSON que usa la app)

---

## Paso 3 — Completar el changelog (manual)
Abrí `docs/CHANGELOG.md` y en la sección:
- `## 1.2.0 (Unreleased)`

Reemplazá el placeholder por bullets reales:
- `- Nueva pantalla de X`
- `- Fix de Y`
- `- Mejora de Z`

Guardá el archivo.

---

## Paso 4 — Cerrar el release (automático)
Cuando ya lo querés “publicar”:
- `npm run release:finalize`

Esto hace:
- `Unreleased` → fecha (`YYYY-MM-DD`)
- crea el siguiente `Unreleased` (ej. `1.2.1 (Unreleased)`)
- regenera `src/changelog.generated.json`

---

## Paso 5 — Commit + Push (normal)
Comiteá y pusheá los cambios a tu rama principal.

Archivos típicos que cambian:
- `app.json`
- `package.json`
- `docs/CHANGELOG.md`
- `src/changelog.generated.json`

---

## Paso 6 — Crear tag y pushearlo (esto dispara el build automático)
Ejemplo:
- `git tag v1.2.0`
- `git push --tags`

Cuando hacés push del tag:
- GitHub Actions construye el APK (EAS)
- crea el GitHub Release
- sube el APK + sha256

---

## Paso 7 — Verificar (simple)
### GitHub
- Andá a “Releases” y confirmá que exista `v1.2.0` con el asset `.apk`.

### Website
- Abrí:
  - `https://irontrain.motiona.xyz/downloads`
  - `https://irontrain.motiona.xyz/releases.json`

### App
- Abrí la app:
  - si la versión instalada es menor, debería mostrar un alert “Actualización disponible”
  - tocá “Descargar” y debería abrir la web.
