# Arquitectura

## Objetivos
- Local-First: funcionamiento offline, sin autenticación.
- Integridad: escrituras consistentes, transacciones cuando corresponde.
- UX rápida: listas virtualizadas y cachés con invalidación clara.
- Mantenibilidad: responsabilidades separadas por capa.

## Capas
### UI
- Ubicación: `app/`, `components/`.
- Responsabilidad: render, interacción y estado efímero (formularios, modales).
- Reglas:
  - No ejecutar SQL directo.
  - No duplicar reglas de negocio que ya existen en Services/Stores.

### Stores (Zustand)
- Ubicación: `src/store/`.
- Responsabilidad: orquestación de estado y flujos (workout activo, timers, optimistic updates).
- Reglas:
  - Reglas de coherencia y bloqueo (p.ej. workout finalizado no editable).
  - Evitar cálculos pesados en render.

### Services
- Ubicación: `src/services/`.
- Responsabilidad: lógica de dominio, validaciones, queries agregadas, cálculos (1RM, volumen), backups.
- Reglas:
  - No depender de UI.
  - Exponer funciones idempotentes cuando aplica (finalizar/reanudar).

### DB
- Ubicación: `src/services/DatabaseService.ts`.
- Responsabilidad: inicialización SQLite, schema, migraciones, helpers de query.
- Reglas:
  - Migraciones idempotentes.
  - Normalizar parámetros (undefined→null).

## Convenciones clave
- Unidades: kg como base interna para sets y body weight; UI convierte a kg/lbs para entrada/salida.
- Timers: cálculo por timestamp (endAtMs / delta real) para evitar drift en background.
- Estado de workout:
  - `in_progress`: editable, timer activo.
  - `completed`: read-only (sin agregar/editar sets), con opción explícita de reabrir.

