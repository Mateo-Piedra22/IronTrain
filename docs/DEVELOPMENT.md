# Desarrollo

## Documentos relacionados

- [Arquitectura](ARCHITECTURE.md)
- [Base de datos](DATABASE.md)
- [Testing](TESTING.md)
- [CI/CD](CI_CD.md)

## Requisitos

- Node 22.x recomendado.
- NPM instalado.
- Expo tooling para desarrollo mobile.

## Entorno recomendado

- Mantener versión de Node alineada con CI para evitar diferencias locales.
- Instalar dependencias desde raíz antes de correr comandos de app.
- Usar instalación limpia (`npm ci`) cuando haya dudas de lockfile o dependencias rotas.

## Setup rápido

```bash
npm install
npm test -- --watch=false
npx tsc --noEmit
npm start
```

## Flujo diario (mobile)

1. Crear rama corta y descriptiva.
2. Implementar cambio pequeño y focalizado.
3. Validar localmente test + typecheck.
4. Abrir PR con contexto funcional/técnico.
5. Resolver feedback sin mezclar refactors no relacionados.

## Website

```bash
cd website
npm install
npm run dev
```

## Flujo diario (website)

1. Entrar a `website/`.
2. Ejecutar build local si tocaste código de producción.
3. Verificar que cambios de web no rompan scripts compartidos del repo.

## Convenciones

- Cambios pequeños y focalizados.
- No romper APIs internas sin actualizar usos.
- Priorizar coherencia con patrones existentes.

## Convenciones de cambios

- Evitar renombres masivos en PR funcionales.
- Mantener compatibilidad hacia atrás en contratos que usa más de un módulo.
- Si hay migraciones o cambios de esquema, documentar impacto y rollback.
- Si hay cambios de seguridad/CI, reflejarlos también en docs operativos.

## Antes de abrir PR

- Tests locales.
- Typecheck.
- Build web si hubo cambios en `website/`.

## Checklist de PR (mínimo)

- Objetivo de negocio o técnico claro.
- Riesgo identificado (bajo/medio/alto).
- Evidencia de validación local (comandos ejecutados).
- Impacto en documentación evaluado y actualizado si corresponde.

## Señales de calidad esperadas

- CI en verde sin re-runs innecesarios.
- Cambios acotados al alcance del ticket.
- Sin deuda técnica nueva crítica ni bypass de controles.
