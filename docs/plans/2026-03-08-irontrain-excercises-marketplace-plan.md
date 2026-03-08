# Plan de Implementación Maestro: Marketplace Oficial de Ejercicios (IronTrain)

Este documento define la arquitectura técnica para el **Marketplace de Ejercicios** de IronTrain. La prioridad es una **deduplicación ultra-robusta** y la preservación de la personalización del usuario, manteniendo el esquema de base de datos lo más ligero posible sin campos de "catálogo" adicionales en la tabla principal de ejercicios.

---

## 1. Arquitectura de Datos y Traceabilidad (`website/src/db/schema.ts`)

Para lograr una deduplicación profesional sin inflar la tabla de ejercicios, utilizaremos los campos de sistema existentes y añadiremos trazas de origen mínimas en las tablas de soporte.

### 1.1. Trazabilidad de Origen (Deduplicación Robusta)
Para que el motor de sincronización sepa qué elementos locales "nacieron" de un elemento oficial, añadiremos `originId` a las tablas de categorías y medallas. Esto permite que el sistema detecte matches exactos incluso si el usuario les cambia el nombre localmente.

```typescript
// website/src/db/schema.ts minimal additions

// 1. Categories: Trazabilidad para deduplicación
export const categories = pgTable('categories', {
    // ... existentes (id, name, isSystem, color, userId, etc.) ...
    originId: text('origin_id'), // ID de la categoría maestra del marketplace
});

// 2. Badges: Trazabilidad para deduplicación
export const badges = pgTable('badges', {
    // ... existentes (id, name, color, icon, groupName, isSystem, etc.) ...
    originId: text('origin_id'), // ID de la medalla maestra del marketplace
});

// Nota: La tabla 'exercises' NO se modifica. 
// Utilizaremos el campo 'originId' y 'isSystem' que ya existen.
```

---

## 2. El Motor de Deduplicación ("The Brain")

El sistema utiliza un **`MarketplaceResolver`** en el backend que opera bajo una lógica de "Capa de Protección de Usuario".

### 2.1. Lógica de Resolución de 3 Niveles (Dura y Blanda)

| Nivel | Tipo | Acción |
| :--- | :--- | :--- |
| **Nivel 1: Hard Link** | Lógica Dura | Busca `exercises` donde `userId = current_user` AND `originId = system_id`. Si existe, **no se descarga**. |
| **Nivel 2: Semantic Sync** | Lógica Blanda | Si la categoría maestra del sistema se llama "Legs", el motor busca en las categorías del usuario una llamada "Piernas", "Pierna" o "Legs" (Normalización + Diccionario de sinónimos). |
| **Nivel 3: Auto-Link** | Lógica Dura | Si el usuario ya tiene un ejercicio llamado "Press de Banca" (creado por él), el sistema puede vincularle el `originId` oficial para considerarlo "oficializado" en futuras actualizaciones. |

---

## 3. Backend: Flujo de Adoptación Transaccional

El endpoint `POST /api/marketplace/checkout` garantiza que la biblioteca del usuario siempre sea consistente.

1. **Resolución de Categorías y Medallas:**
    - Antes de crear el ejercicio, el sistema busca la categoría necesaria del usuario mediante `originId` (Priority 1) o `normalized_name` (Priority 2).
    - Si existe, se usa ese `id` local (preserva sus colores).
    - Si no existe, se inserta una nueva clonando la del sistema (`isSystem = 0`, `originId = master_id`).
2. **Clonación de Ejercicio:**
    - Se inserta el registro en `exercises` usando los campos estándar: `name`, `type`, `categoryId`, etc.
    - Se asigna `isSystem = 0` (local) y el `originId` del maestro.
3. **Atomicidad:** Todo se ejecuta en una sola transacción SQL. Si una medalla falla en vincularse, no se crea el ejercicio.

---

## 4. Gestión y Marketplace UI

### 4.1. Panel Administrativo (`/admin/marketplace`)
- El administrador gestiona los ejercicios donde `isSystem = 1`.
- Los datos visuales para la web (descripciones detalladas o imágenes) se manejan mediante metadatos externos o simplemente utilizando el campo `notes` existente en la tabla de ejercicios de forma estructurada.

### 4.2. UI de Usuario (Marketplace Web)
- **Visualización:** Grid simple de ejercicios oficiales con sus medallas asociadas.
- **Deduplicación Visual:** Si el usuario ya posee un ejercicio (detectado por `originId` en el lado del cliente), el botón de selección se deshabilita con el texto "Ya en tu biblioteca".

---

## 5. Mobile Sync: Sincronización Invisible

- **Gatillo:** El Checkout web dispara un push o un deep link `irontrain://sync`.
- **Ejecución:** La App móvil invoca el servicio de sincronización existente. Como el backend ya hizo la parte difícil (crear los registros locales vinculados), la app simplemente descarga los nuevos IDs de ejercicios, categorías y medallas como si fueran registros normales de ese usuario.

---

## 6. Casos de Borde y Lógica de Conflictos

- **Renombrado Local:** Si el usuario adopta "Sentadilla" y luego la renombra a "Squat", el `originId` garantiza que el Marketplace siga sabiendo que ya la tiene.
- **Categoría similar pero distinta:** Si el usuario tiene una categoría "Piernas" y adopta un ejercicio de la categoría maestra "Legs", el sistema mapea "Legs" -> "Piernas" automáticamente para no crear categorías duplicadas.
- **Eliminación Maestra:** Si el Admin borra un ejercicio oficial del marketplace, los ejercicios que los usuarios ya adoptaron (clones locales) **no se borran**, preservando la integridad del historial de entrenamiento del usuario.

---

## 7. Optimización de Performance

- **One-Shot Queries:** El backend trae todas las categorías/medallas del usuario en una sola consulta inicial para hacer el "matching" en memoria, reduciendo la carga en la base de datos durante checkouts masivos.
- **Rate Limiting:** Límites estrictos para evitar abusos en el clonado masivo de ejercicios.

---

*Revisión Técnica - Enfoque en Deduplicación Robusta y Schema Minimalista*
