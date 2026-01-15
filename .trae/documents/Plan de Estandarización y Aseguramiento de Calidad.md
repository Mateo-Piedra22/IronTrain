# Plan de Estandarización y Aseguramiento de Calidad (IronTrain)

Para cumplir con el objetivo de "pulir y endurecer" el sistema antes de nuevas funcionalidades, he diseñado un plan de 3 fases que aborda la documentación, la deuda técnica crítica (lógica duplicada) y la cobertura de pruebas.

## Fase 1: Documentación Técnica Exhaustiva 📘
Crearemos un "Libro Maestro" de la arquitectura actual para establecer la verdad única sobre el comportamiento del sistema.
*   **Acción:** Crear `docs/TECHNICAL_SPECS.md`.
*   **Contenido:**
    *   **Arquitectura de Capas:** Definir roles de `Store` (Estado UI) vs `Service` (Lógica de Negocio) vs `Database` (Persistencia).
    *   **Diccionario de Datos:** Especificaciones de `Workout`, `Set`, `Exercise` con reglas de validación (ej: pesos no negativos).
    *   **Flujos Críticos:** Diagrama de secuencia (texto) para "Start Workout", "Add Set (Ghost Values)" y "Finish Workout".

## Fase 2: Refactorización y Estandarización (Core Logic) 🛠️
Durante la auditoría detecté una **duplicidad de lógica crítica**: `useWorkoutStore` implementa su propia lógica de creación de sets e interacción con la BD, ignorando las reglas de negocio centralizadas en `WorkoutService`.
*   **Objetivo:** Centralizar TODA la lógica de negocio en `src/services/`.
*   **Tareas:**
    1.  **Potenciar `WorkoutService`:** Mover la lógica de "Ghost Values" (valores sugeridos basados en historial) y validaciones dentro de métodos robustos (`addSet`, `updateSet`).
    2.  **Adelgazar `useWorkoutStore`:** Convertirlo en un consumidor puro que solo llama a `WorkoutService` y actualiza el estado local, eliminando las llamadas directas a `dbService`.
    3.  **Estandarizar Errores:** Implementar un manejo de errores consistente que propague fallos de la BD hacia la UI de forma controlada.

## Fase 3: Cobertura de Pruebas al 100% 🧪
Una vez estandarizada la lógica, escribiremos pruebas blindadas para asegurar que no existan regresiones.
*   **Nuevos Tests Unitarios:**
    *   `src/services/__tests__/WorkoutService.test.ts`: Probar flujos completos de entrenamiento, lógica de templates y cálculo de 1RM.
    *   `src/services/__tests__/ExerciseService.test.ts`: Validar integridad referencial (no borrar ejercicios con historial).
*   **Meta:** Asegurar que cada método público tenga al menos un caso de éxito y uno de error documentado.

---

### ¿Por qué este orden?
No tiene sentido escribir tests para el código actual de `useWorkoutStore` si vamos a refactorizarlo para cumplir con los "Estándares de Código" que solicitaste. Primero limpiamos la arquitectura (Fase 2) y luego la sellamos con pruebas (Fase 3).

¿Procedo con la **Fase 1 (Documentación)** y **Fase 2 (Refactorización)** inmediatamente?