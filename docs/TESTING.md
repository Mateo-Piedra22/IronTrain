# Testing

## Documentos relacionados

- [Desarrollo](DEVELOPMENT.md)
- [CI/CD](CI_CD.md)
- [Release](RELEASE.md)

## Objetivo

Garantizar estabilidad funcional en mobile y website antes de merge/release.

## Estrategia mínima

- Probar primero el alcance exacto del cambio.
- Ejecutar validaciones de integración (typecheck/build) antes de abrir PR.
- Mantener foco en regresiones de flujos críticos: entrenamiento, rutinas y sincronización social/rutinas compartidas.

## Mobile

```bash
npm test -- --watch=false
```

## Mobile: qué cubrir

- Lógica de negocio en servicios y stores.
- Comportamiento de componentes críticos cuando cambian props/estado.
- Casos de error esperados (datos incompletos, estados vacíos, conflictos de sync).

## Website

```bash
cd website
npm test
```

## Website: qué cubrir

- Rutas y componentes de vistas principales.
- Transformaciones de datos y utilidades de dominio.
- Casos de fallo previsibles en consumo de datos.

## Validaciones complementarias

```bash
npx tsc --noEmit
cd website && npm run build
```

## Matriz sugerida por tipo de cambio

- Cambio solo mobile: test mobile + typecheck root.
- Cambio solo website: test/build website + chequeo de scripts compartidos.
- Cambio transversal: test mobile + test/build website + typecheck completo.

## Regla

No mergear cambios críticos sin al menos test + typecheck en verde.

## Criterio de salida para release

- Sin fallos en checks requeridos.
- Sin flakiness repetida sin causa identificada.
- Evidencia de validación en PR para cambios de riesgo medio/alto.
