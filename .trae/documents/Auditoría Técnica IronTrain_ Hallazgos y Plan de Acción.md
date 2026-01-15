# Plan de Implementación: Correcciones Críticas y Mejoras Técnicas

Basado en la auditoría exhaustiva realizada, he detectado **vulnerabilidades de seguridad críticas** y **problemas de rendimiento** que deben ser abordados de inmediato, además de deuda técnica en accesibilidad y pruebas.

## 1. 🚨 Prioridad Alta: Seguridad y Datos (Inmediato)
### A. Corregir Vulnerabilidad en BackupService
El sistema actual de importación es vulnerable a **SQL Injection** y está incompleto.
1.  **Seguridad:** Implementar validación de lista blanca (whitelist) para las claves del JSON antes de insertarlas en la BD.
2.  **Integridad de Datos:** Agregar las tablas faltantes (`measurements`, `plate_inventory`, `goals`) al proceso de exportación e importación para evitar pérdida de datos del usuario.

### B. Optimizar Rendimiento de Base de Datos
Los índices definidos en el diseño no se están aplicando en la realidad.
1.  **Aplicar Índices:** Mover la creación de índices (`CREATE INDEX`) al método de inicialización en `DatabaseService.ts` para acelerar las consultas de historiales y ejercicios.

## 2. 🛠 Prioridad Media: Accesibilidad y Calidad (Corto Plazo)
### A. Accesibilidad (A11y)
La app es actualmente invisible para lectores de pantalla.
1.  **Componentes Base:** Agregar props `accessibilityLabel` y `accessibilityRole` a `IronButton`, `IronInput` e `IronCard`.

### B. Configuración de Entorno de Desarrollo
1.  **Linting:** Configurar ESLint y Prettier para estandarizar el código.
2.  **Testing:** Instalar y configurar `jest` y `jest-expo`. Crear un script de prueba (`npm test`) funcional.

## 3. 📉 Prioridad Baja: Refactorización (Largo Plazo)
1.  **Limpieza de Estilos:** Migrar estilos inline (`style={{...}}`) a clases de NativeWind (`className="..."`) en componentes como `SafeAreaWrapper`.
2.  **Optimización de Memoria:** Refactorizar el BackupService para usar *streams* o paginación en lugar de cargar toda la DB en RAM (prevención de cierres inesperados).

---

## Confirmación
¿Deseas que proceda con la ejecución de la **Fase 1 (Seguridad y Datos)** para asegurar la integridad de la aplicación antes de pasar a las mejoras de UI?
