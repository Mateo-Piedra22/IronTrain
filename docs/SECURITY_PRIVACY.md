# Seguridad y privacidad

## Documentos relacionados

- [Arquitectura](ARCHITECTURE.md)
- [Runbook operacional](RUNBOOK.md)

## 1) Objetivo

Definir el baseline de seguridad y privacidad de IronTrain para desarrollo, operación y release.

## 2) Principios

1. **Mínimo privilegio:** workflows y accesos con permisos estrictamente necesarios.
2. **Defensa en profundidad:** controles de código + dependencias + proceso de PR.
3. **No secretos en repositorio:** credenciales solo en secretos gestionados.
4. **Privacidad por defecto:** evitar recolección o exposición innecesaria de datos sensibles.

## 3) Superficie principal de riesgo

- Supply chain (dependencias npm y actions).
- Errores de configuración de CI/CD.
- Exposición accidental de secretos.
- Logging de información sensible.
- Manejo de payloads remotos en flujos sociales.

## 4) Controles activos actuales

## 4.1 Pipeline de seguridad

- `security.yml` ejecuta:
  - CodeQL (JS/TS).
  - `npm audit` de dependencias de producción (root y website).

## 4.2 Guardrails en PR

- `dependency-review-action` en PR.
- Plantilla de PR con checklist de riesgo y validación.

## 4.3 Mantenimiento continuo

- Dependabot para:
  - npm root,
  - npm website,
  - GitHub Actions.

## 5) Requisitos de desarrollo seguro

## 5.1 Secretos

- Nunca hardcodear tokens/keys/secrets.
- Usar GitHub Secrets para CI/CD.
- Rotar credenciales ante cualquier sospecha de exposición.

## 5.2 Logging

- Prohibido loguear tokens, emails completos, payloads sensibles o credenciales.
- En errores, registrar solo contexto técnico mínimo necesario.

## 5.3 Validación y robustez

- Validar tipos y estados inesperados en contratos de red.
- Manejar errores de API con rutas explícitas (incluyendo conflictos 409 en sincronización social/rutinas compartidas).
- Evitar que fallas de red rompan la experiencia local-first.

## 6) Privacidad de datos

## 6.1 Mobile

- La app opera con persistencia local (SQLite) como pilar principal.
- Minimizar sincronización de datos no esenciales para funcionalidad.

## 6.2 Website/servicios

- Tratar datos de usuario con necesidad mínima.
- Evitar exposición innecesaria en respuestas de API.

## 6.3 Retención y minimización

- Registrar únicamente lo requerido para operación/observabilidad.
- Reducir vida útil de datos sensibles cuando sea posible.

## 7) Seguridad en CI/CD

## 7.1 Recomendaciones obligatorias

- Branch protection en `main`.
- Required checks de calidad y seguridad.
- Restricción de force-push.
- Revisión obligatoria por PR en cambios críticos.

## 7.2 Buenas prácticas de workflow

- Declarar `permissions` mínimos por workflow/job.
- Usar `concurrency` para reducir carreras y estados inconsistentes.
- Configurar `timeout-minutes` para evitar jobs colgados.

## 8) Respuesta a incidentes de seguridad

## 8.1 Detección

- Hallazgo CodeQL.
- Vulnerabilidad crítica en auditoría de dependencias.
- Evidencia de secreto comprometido.

## 8.2 Acciones inmediatas

1. Clasificar severidad.
2. Contener impacto (bloquear merge/release si aplica).
3. Rotar secretos comprometidos.
4. Preparar fix y PR de mitigación.

## 8.3 Validación de cierre

- Security pipeline en verde.
- Riesgo residual documentado.
- Acción preventiva definida.

## 9) Checklist rápido por PR

- [ ] No se agregan secretos ni credenciales.
- [ ] No hay logs con datos sensibles.
- [ ] Cambios de dependencia revisados por impacto.
- [ ] Typecheck/tests/build relevantes en verde.
- [ ] Documentación actualizada si cambia postura de seguridad/privacidad.
