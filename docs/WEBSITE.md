# Website

## Resumen

El sitio web vive en `website/` y funciona como módulo separado de la app mobile.

## Stack

- Next.js 15
- React 19
- Drizzle ORM
- Postgres/Neon

## Comandos

```bash
cd website
npm install
npm run dev
npm run build
npm test
```

## Integración de contenido

- Antes de `dev/build` se ejecuta `scripts/sync-content.mjs`.
- Esto mantiene contenido web alineado con artefactos del proyecto raíz.
