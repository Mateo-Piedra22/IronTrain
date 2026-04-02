# Comandos operativos

## Documentos relacionados

- [Runbook operacional](RUNBOOK.md)
- [Troubleshooting](TROUBLESHOOTING.md)
- [CI/CD](CI_CD.md)

## Calidad (root)

```bash
npm test -- --watch=false
npx tsc --noEmit
```

Uso recomendado: ejecutar antes de abrir PR o luego de tocar lógica compartida.

## Ejecución app

```bash
npm start
npm run android
npm run ios
npm run web
```

Uso recomendado: validar flujos funcionales básicos tras cambios de UI/estado.

## Release helpers

```bash
npm run generate-changelog
npm run release:prepare
npm run release:finalize
```

Uso recomendado: preparar releases con trazabilidad de cambios y versión.

## Website

```bash
cd website
npm run dev
npm run build
npm test
```

Uso recomendado: ejecutar `build` cuando se modifiquen rutas o lógica de producción web.

## Comandos para diagnóstico rápido

```bash
npm ci
npm test -- --watch=false
npx tsc --noEmit
cd website && npm run build
```

Uso recomendado: primer barrido ante incidentes de CI o regressions no claras.

## Buenas prácticas operativas

- Ejecutar comandos desde la raíz correcta del módulo (root vs `website/`).
- Evitar mezclar validaciones parciales con decisiones de merge/release.
- Registrar en PR qué comandos fueron corridos en cambios de riesgo medio/alto.
