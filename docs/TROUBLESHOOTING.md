# Troubleshooting

## Documentos relacionados

- [Runbook operacional](RUNBOOK.md)
- [Comandos operativos](OPERATIONS_COMMANDS.md)
- [CI/CD](CI_CD.md)

## CI falla en `npm ci`

- Borrar lock inconsistente y reinstalar.
- Validar versión de Node (22.x en CI).

Diagnóstico sugerido:

1. Confirmar versión de Node local.
2. Ejecutar instalación limpia.
3. Comparar lockfile y dependencias cambiadas en PR.

## Typecheck falla

- Revisar errores de tipos en archivos modificados.
- Evitar `any` innecesarios en contratos compartidos.

Diagnóstico sugerido:

1. Localizar primer error real (los demás suelen ser cascada).
2. Revisar contratos en servicios/stores antes que UI.
3. Revalidar con `npx tsc --noEmit`.

## Build website falla

- Ejecutar `cd website && npm run build` local.
- Revisar variables de entorno requeridas del sitio.

Diagnóstico sugerido:

1. Aislar error de compilación vs error de runtime.
2. Verificar imports, rutas y tipados en páginas tocadas.
3. Confirmar que scripts/build del website usan el entorno esperado.

## Release Android falla

- Verificar tag `vMAJOR.MINOR.PATCH`.
- Verificar secretos de GitHub Actions.

Diagnóstico sugerido:

1. Revisar etapa exacta fallida (preflight, build, publicación).
2. Confirmar secretos vigentes y permisos del workflow.
3. Reintentar solo después de corregir causa raíz.

## Sync social inconsistente

- Forzar recarga de datos y repetir acción.
- Revisar conflictos de revisión en workspaces.

Diagnóstico sugerido:

1. Confirmar versión/baseRevision de payload compartido.
2. Identificar conflicto 409 o estado obsoleto en cliente.
3. Aplicar resolución controlada y verificar no duplicación de rutina local.

## Escalamiento

- Escalar cuando el incidente impacta release productivo.
- Escalar cuando hay sospecha de seguridad o exposición de datos.
- Escalar cuando no hay diagnóstico claro tras el primer ciclo de análisis.
