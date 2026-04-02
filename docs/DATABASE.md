# Base de datos

## Documentos relacionados

- [Arquitectura](ARCHITECTURE.md)
- [Runbook operacional](RUNBOOK.md)
- [Troubleshooting](TROUBLESHOOTING.md)

## Mobile (SQLite)

- DB local: `irontrain_v1.db`.
- Servicio central: `src/services/DatabaseService.ts`.
- Esquema evolutivo con migraciones controladas.

## Principios de persistencia mobile

- La app usa enfoque local-first como fuente principal de lectura/escritura.
- Las operaciones remotas no deben bloquear el flujo principal de entrenamiento.
- El esquema local debe tolerar upgrades graduales sin romper instalaciones existentes.

## Puntos importantes actuales

- Persistencia de entrenamientos, rutinas, ejercicios, categorías y analítica local.
- Soporte para social feed/cache local.
- Tabla `shared_routine_links` para enlazar rutina local con rutina compartida remota.

## `shared_routine_links`: propósito operativo

- Evitar crear duplicados de rutinas cuando llega contenido compartido.
- Mantener trazabilidad entre entidad remota y entidad local.
- Permitir resolver conflictos de revisión en sincronización social/rutinas compartidas.

## Reglas de migración

- Siempre idempotentes.
- No romper instalaciones existentes.
- Evitar cambios destructivos sin estrategia de recuperación.

## Política de migraciones

1. Diseñar migración compatible con estado previo.
2. Probar migración sobre base existente y base nueva.
3. Registrar impacto funcional esperado.
4. Definir rollback lógico cuando aplique.

## Qué evitar en cambios de esquema

- Eliminar columnas/tablas sin plan de recuperación.
- Reusar campos con significado distinto sin migración explícita.
- Acoplar lógica de UI a detalles internos de storage.

## Website

- Persistencia en Postgres (Neon) con Drizzle.
- Scripts de schema y migración en `website/`.

## Contraste mobile vs website

- Mobile: SQLite orientado a resiliencia offline.
- Website: Postgres orientado a servicios web y consultas remotas.
- Ambos módulos evolucionan de forma independiente y requieren compatibilidad a nivel de contratos.

## Checklist al tocar datos

- ¿Hay impacto en migraciones existentes?
- ¿El cambio mantiene comportamiento local-first?
- ¿Afecta sincronización social/rutinas compartidas?
- ¿Se actualizó documentación operativa si cambió el flujo?
