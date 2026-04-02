# Pull Request Checklist

## Resumen

- ¿Qué cambia?
- ¿Por qué era necesario?

## Validación técnica

- [ ] `npm test -- --watch=false`
- [ ] `npx tsc --noEmit`
- [ ] Si cambió `website/`, `cd website && npm run build`

## Riesgo y seguridad

- [ ] No se agregaron secretos/tokens/keys
- [ ] No se expone información sensible en logs
- [ ] Si hay cambios de datos, existe ruta de rollback
- [ ] Riesgos conocidos documentados en la PR

## Release

- [ ] Impacto en release evaluado
- [ ] Documentación actualizada si aplica
