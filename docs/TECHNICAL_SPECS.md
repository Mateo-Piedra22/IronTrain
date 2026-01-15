# Especificaciones Técnicas IronTrain

## 1. Arquitectura del Sistema
El sistema sigue una arquitectura **Local-First** de tres capas:

1.  **Capa de Presentación (UI/Store)**
    *   **Componentes React Native**: Renderizado de UI.
    *   **Zustand Stores (`useWorkoutStore`)**: Gestión del estado efímero de la UI (timers, formularios). **Regla:** No debe contener lógica de negocio compleja ni llamadas SQL directas. Debe delegar a los Servicios.

2.  **Capa de Servicio (Business Logic)**
    *   **Services (`WorkoutService`, `ExerciseService`)**: Contienen las reglas de negocio, validaciones, cálculos (1RM, Volumen) y orquestación de datos. Son la única puerta de entrada para modificar datos.

3.  **Capa de Persistencia (Data Access)**
    *   **DatabaseService**: Abstracción sobre `expo-sqlite`. Ejecuta queries SQL crudos. No contiene reglas de negocio.
    *   **SQLite**: Motor de base de datos local.

---

## 2. Diccionario de Datos y Reglas

### Workout (Entrenamiento)
*   **id**: UUID v4.
*   **status**: `in_progress` | `completed`.
*   **date**: Timestamp Unix (ms).
*   **Reglas**:
    *   Un usuario solo puede tener un entrenamiento activo a la vez (recomendado, no forzado por DB).
    *   Al finalizar (`completed`), se debe calcular la duración real.

### Exercise (Ejercicio)
*   **type**: `weight_reps` | `distance_time` | `weight_only` | `reps_only`.
*   **is_system**: 1 (Solo lectura) | 0 (Editable por usuario).
*   **Reglas**:
    *   No se puede eliminar un ejercicio si tiene sets históricos asociados (Integridad Referencial).

### WorkoutSet (Serie)
*   **type**: `normal` | `warmup` | `failure` | `drop`.
*   **Reglas**:
    *   **Ghost Values**: Al crear un set, si no se especifica peso/reps, se deben pre-llenar con los valores del último set completado de ese ejercicio en el historial.
    *   `weight` y `reps` no pueden ser negativos.

---

## 3. Flujos Críticos

### A. Iniciar Entrenamiento
1.  **UI**: Llama a `useWorkoutStore.startWorkout(name)`.
2.  **Store**: Llama a `WorkoutService.createWorkout(date)`.
3.  **Service**: Genera ID, inserta en DB con status `in_progress`.
4.  **Store**: Actualiza estado local `activeWorkout`.

### B. Agregar Set (Ghost Logic)
1.  **UI**: Llama a `useWorkoutStore.addSet(exerciseId)`.
2.  **Store**: Llama a `WorkoutService.addSet(workoutId, exerciseId)`.
3.  **Service**:
    *   Busca último set completado en historial (`dbService.getLastSetForExercise`).
    *   Si existe, usa esos valores como default (Ghost Values).
    *   Inserta nuevo set en DB.
4.  **Store**: Recarga los sets del workout activo.

### C. Finalizar Entrenamiento
1.  **UI**: Llama a `useWorkoutStore.finishWorkout()`.
2.  **Store**: Detiene timer local. Llama a `WorkoutService.finishWorkout(id, duration)`.
3.  **Service**: Actualiza status a `completed` y guarda duración final.
4.  **Store**: Limpia estado `activeWorkout`.

---

## 4. Estándares de Código
*   **Manejo de Errores**: Los servicios lanzan excepciones (`Error`) con mensajes descriptivos. La capa de UI/Store debe capturarlos y mostrar alertas.
*   **Tipado**: Uso estricto de interfaces TypeScript definidas en `src/types/db.ts`.
