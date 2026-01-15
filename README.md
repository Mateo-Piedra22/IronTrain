# IronTrain 🏋️‍♂️

**IronTrain** es una aplicación de entrenamiento de fuerza "Local-First" diseñada para levantadores serios. Ofrece un seguimiento detallado sin distracciones, garantizando la privacidad y propiedad total de los datos.

## 🚀 Características Principales

*   **100% Offline & Privada:** Todos los datos residen en tu dispositivo (SQLite). Sin nubes, sin cuentas, sin suscripciones.
*   **Gestión de Entrenamientos:**
    *   Registro de series con soporte para RPE, calentamiento, dropsets y fallo.
    *   **Ghost Values:** Sugerencia inteligente de pesos basada en tu historial.
    *   Cronómetro de descanso automático.
*   **Análisis Avanzado:**
    *   Estimación automática de **1RM** (Fórmula Epley).
    *   Mapa de calor de consistencia (estilo GitHub).
    *   Gráficos de volumen semanal.
*   **Herramientas Útiles:**
    *   Calculadora de Platos (Barra olímpica, calibrada, etc.).
    *   Calculadora de 1RM inversa.
*   **Seguridad de Datos:**
    *   Exportación e Importación completa en formato JSON.
    *   Validación estricta de esquemas para prevenir corrupción.

## 🛠️ Tecnologías

*   **Core:** React Native (Expo SDK 52)
*   **Navegación:** Expo Router (File-based routing)
*   **Base de Datos:** `expo-sqlite` (Motor SQL local)
*   **Estado:** Zustand (Gestión ligera y reactiva)
*   **Estilos:** NativeWind (Tailwind CSS para RN)
*   **Gráficos:** `react-native-gifted-charts`

## 🏗️ Arquitectura

El proyecto sigue una arquitectura de 3 capas estricta para garantizar mantenibilidad y testabilidad:

1.  **UI Layer (`app/`, `components/`)**:
    *   Componentes puramente visuales.
    *   Manejo de estado efímero (formularios, modales).
    *   Delega toda la lógica de negocio a los Stores/Servicios.

2.  **State Layer (`src/store/`)**:
    *   **Zustand Stores** (`useWorkoutStore`): Orquesta la interacción entre la UI y los Servicios.
    *   Mantiene el estado de la sesión activa (timer, sets actuales).

3.  **Service Layer (`src/services/`)**:
    *   **Lógica de Negocio Pura**: `WorkoutService`, `AnalysisService`.
    *   Validaciones, cálculos complejos y reglas de integridad.
    *   Único punto de acceso a la base de datos.

4.  **Data Layer (`src/services/DatabaseService.ts`)**:
    *   Wrapper sobre SQLite.
    *   Manejo de migraciones y consultas crudas.

## 🧪 Calidad y Pruebas

*   **Unit Testing:** Jest + React Test Renderer.
*   **Cobertura:**
    *   Servicios Críticos (`BackupService`, `WorkoutService`): 100% testados.
    *   UI Components: Snapshot testing para prevenir regresiones visuales.
*   **Seguridad:** Validación de "Whitelist" en importaciones para prevenir SQL Injection.

## 🏁 Comenzar

1.  **Instalar dependencias:**
    ```bash
    npm install
    ```
2.  **Iniciar servidor de desarrollo:**
    ```bash
    npx expo start
    ```
3.  **Ejecutar pruebas:**
    ```bash
    npm test
    ```

## 📄 Licencia

Este proyecto es de uso personal y educativo.
