# IronTrain

IronTrain es una app mobile de entrenamiento de fuerza construida con Expo + React Native, con enfoque local-first y sincronización social progresiva.

## TL;DR (onboarding rápido)

- App principal: mobile (Expo/React Native) con persistencia local-first en SQLite.
- Website separado en `website/` con Next.js + Drizzle + Neon/Postgres.
- Estado global mobile: Zustand; navegación: Expo Router.
- Calidad obligatoria antes de merge: tests + typecheck + checks de CI/Security.
- Workflows clave: `ci.yml`, `security.yml`, `release-android.yml`.
- Release Android: tag semver `vMAJOR.MINOR.PATCH` y pipeline automatizado.
- Docs operativas base: `docs/RUNBOOK.md`, `docs/TROUBLESHOOTING.md`, `docs/SECURITY_PRIVACY.md`.
- Punto de entrada recomendado para contribuir: secciones “Inicio rápido” + “Flujo recomendado de desarrollo” de este README.

## Qué es IronTrain

- Producto principal: app mobile para planificación, registro y seguimiento de entrenamientos.
- Pilar técnico: persistencia local-first para resiliencia offline.
- Capas complementarias: sincronización social/rutinas compartidas y website desacoplado.
- Objetivo operativo: calidad y seguridad verificables antes de merge/release.

## Estado actual

- Plataforma principal: app mobile Expo SDK 54.
- Sitio web separado en `website/` (Next.js 15).
- Persistencia local en SQLite (`expo-sqlite`).
- Estado global con Zustand.
- CI unificado en `.github/workflows/ci.yml`.
- Seguridad continua en `.github/workflows/security.yml`.

## Arquitectura resumida

- Mobile (raíz del repo): Expo Router + Zustand + SQLite.
- Website (`website/`): Next.js App Router + Drizzle + Neon/Postgres.
- Integración: módulos desacoplados en runtime, alineados por lineamientos de producto y contratos.
- Operación: workflows de CI, seguridad y release Android como guardrails de calidad.

## Stack

- Mobile: React Native 0.81, React 19, Expo Router.
- Web: Next.js 15, React 19, Drizzle ORM, Neon/Postgres.
- Testing: Jest (mobile) y Vitest (website).

## Estructura del repositorio (alto nivel)

- `app/`: rutas y pantallas Expo Router.
- `components/`: UI reutilizable y widgets.
- `src/`: servicios, estado, hooks y lógica de dominio.
- `docs/`: documentación operativa y técnica vigente.
- `website/`: aplicación web desacoplada.
- `.github/workflows/`: pipelines de CI, seguridad y release.

## Inicio rápido

### Prerrequisitos

- Node 22.x recomendado.
- npm.
- Tooling de Expo para desarrollo local mobile.

### Setup inicial (root)

```bash
npm install
npm test -- --watch=false
npx tsc --noEmit
npm start
```

### Setup website

```bash
cd website
npm install
npm run dev
```

## Comandos principales (mobile)

```bash
npm install
npm test -- --watch=false
npx tsc --noEmit
npm start
```

Comandos frecuentes de ejecución:

```bash
npm run android
npm run ios
npm run web
```

## Comandos principales (website)

```bash
cd website
npm install
npm run dev
npm run build
```

## Flujo recomendado de desarrollo

1. Crear rama pequeña y con alcance claro.
2. Implementar cambio focalizado.
3. Ejecutar validaciones locales (test + typecheck, y build web si aplica).
4. Abrir PR con contexto de riesgo y evidencia de validación.
5. Mergear solo con checks requeridos en verde.

## CI/CD y seguridad

- CI principal: `.github/workflows/ci.yml`.
- Seguridad continua: `.github/workflows/security.yml`.
- Release Android: `.github/workflows/release-android.yml`.
- Guardrails clave: permisos mínimos, checks requeridos, dependency review y escaneo de dependencias.

## Release Android (resumen)

1. Preparar changelog y versión.
2. Crear tag semver: `vMAJOR.MINOR.PATCH`.
3. Dejar que `release-android.yml` construya y publique artefactos.
4. Verificar checksum y notas de release.

## Troubleshooting rápido

- Si falla CI en instalación: validar Node + lockfile.
- Si falla typecheck: corregir primer error raíz antes de los de cascada.
- Si falla build website: reproducir localmente en `website/`.
- Si falla release Android: revisar tag semver y secretos.
- Si hay inconsistencias de sincronización social/rutinas compartidas: revisar conflictos de revisión y estado local/remoto.

## Documentación

### Índice rápido por tema

- Arquitectura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Desarrollo: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- Base de datos: [docs/DATABASE.md](docs/DATABASE.md)
- CI/CD: [docs/CI_CD.md](docs/CI_CD.md)
- Guardrails DevOps: [docs/DEVOPS_GUARDRAILS.md](docs/DEVOPS_GUARDRAILS.md)
- Testing: [docs/TESTING.md](docs/TESTING.md)
- Release: [docs/RELEASE.md](docs/RELEASE.md)
- Distribución: [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md)
- Runbook operacional: [docs/RUNBOOK.md](docs/RUNBOOK.md)
- Comandos operativos: [docs/OPERATIONS_COMMANDS.md](docs/OPERATIONS_COMMANDS.md)
- Troubleshooting: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- Seguridad y privacidad: [docs/SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md)

## Notas

- Este repositorio contiene también archivos de soporte de agentes y planes históricos.
- Para cambios operativos, priorizar siempre los documentos bajo `docs/`.

## Criterio de calidad para cambios

- Sin checks críticos fallando en PR.
- Sin cambios de alto riesgo sin documentación/mitigación.
- Documentación técnica actualizada cuando cambia arquitectura, operación o seguridad.
