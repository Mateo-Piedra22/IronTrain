# Especificación funcional (visión)

Este documento describe la visión funcional de IronTrain. Algunas secciones pueden estar parcialmente implementadas; la referencia técnica real está en `docs/`.

## Identidad visual (actual)
- Fondo principal: `#fff7f1` (iron-900)
- Superficie/tarjeta: `#ffffff` (iron-800)
- Texto principal: `#321414` (iron-950)
- Primario: `#5c2e2e` (primary)

## **1\. El Diario de Entrenamiento (Pantalla Principal)**

El núcleo de la aplicación. Debe ser rápido y libre de fricción.

### **1.1. Navegación y Estructura**

* **Navegación por Fecha:** Deslizamiento (Swipe) izquierda/derecha para cambiar de día. Selector de calendario rápido en la barra superior.  
* **Lista de Ejercicios del Día:** Los ejercicios se agrupan visualmente.  
* **Reordenamiento:** Capacidad de arrastrar y soltar (Drag & Drop) para reordenar ejercicios dentro de una sesión.  
* **Copiar/Pegar Entrenamiento:** Función para copiar el entrenamiento completo de un día y pegarlo en otro.

### **1.2. Lógica de Series (Sets)**

* **Campos de Entrada:** Peso (kg/lbs), Repeticiones, Distancia (m/km), Tiempo (h:m:s).  
* **Etiquetado de Series (Tags):** Cada serie debe poder marcarse como:  
  * *Normal* (Default)  
  * *Calentamiento* (Warm-up) \- Opción para excluir del cálculo de volumen/stats.  
  * *Fallo* (Failure)  
  * *Dropset*  
  * *RP* (Record Personal) \- Detección automática.  
* **Ghost Values (Valores Fantasma):** Al crear una nueva serie, pre-llenar los campos con los valores de la serie anterior o de la sesión histórica anterior para agilizar la entrada.  
* **Comentarios:**  
  * Comentarios a nivel de *Serie* (ej: "Mala técnica").  
  * Comentarios a nivel de *Ejercicio* (ej: "Usar banco inclinado 30º").  
  * Comentarios a nivel de *Sesión* (ej: "Me sentí cansado hoy").

### **1.3. Superseries (Supersets)**

* Capacidad de agrupar dos o más ejercicios como una "Superserie".  
* Visualización: Una línea vertical de color (Naranja IronTrain) conectando los ejercicios agrupados.

## **2\. Base de Datos de Ejercicios**

Gestión completa de la biblioteca de movimientos.

### **2.1. Categorías**

* **Categorías por Defecto:** Pecho, Espalda, Piernas, Hombros, Bíceps, Tríceps, Abdominales, Cardio.  
* **Gestión de Categorías:** Crear nueva, Editar nombre, Cambiar color (Paleta IronTrain), Eliminar, Reordenar.

### **2.2. Ejercicios**

* **Tipos de Ejercicio:**  
  * Peso y Repeticiones (Musculación estándar).  
  * Distancia y Tiempo (Cardio/Running).  
  * Solo Peso.  
  * Solo Repeticiones (Calistenia sin lastre).  
* **Configuración por Ejercicio:**  
  * *Incremento por defecto:* (ej: Mancuernas suben de 2.5kg, Máquinas de 5kg).  
  * *Notas fijas:* Notas que aparecen siempre que seleccionas ese ejercicio (ej: "Asiento en posición 4").  
* **Creación de Ejercicios:** El usuario puede crear ilimitados ejercicios personalizados y asignarlos a categorías.

## **3\. Análisis y Estadísticas**

El "cerebro" de la aplicación. Todo debe ser visualizable mediante gráficos.

### **3.1. Historial del Ejercicio**

* **Lista Cronológica:** Ver todas las veces que se ha realizado un ejercicio específico, agrupado por fecha.  
* **Filtrado:** Ver solo Récords Personales (PRs).  
* **Comparativa:** Ver "Qué hice la última vez" vs "Qué hice hoy".

### **3.2. Gráficos de Progreso (Por Ejercicio)**

* **Métricas a Graficar:**  
  * 1RM Estimado (Fórmula seleccionable: Epley, Brzycki, etc.).  
  * Peso Máximo levantado.  
  * Volumen Total (Series x Reps x Peso).  
  * Repeticiones Totales.  
* **Periodos:** 1 Mes, 3 Meses, 6 Meses, 1 Año, Todo el tiempo.

### **3.3. Análisis Global (Body Stats)**

* **Distribución de Entrenamiento:** Gráfico de torta (Pie Chart) mostrando % de series por grupo muscular (ej: 20% Pecho, 30% Pierna).  
* **Mapa de Calor (Calendar Heatmap):** Visualización de consistencia en el calendario (días entrenados vs días de descanso).

## **4\. Herramientas de Sesión (Utilities)**

### **4.1. Temporizador de Descanso (Rest Timer)**

* **Modos:**  
  * *Manual:* Tocar el reloj para iniciar.  
  * *Automático:* Iniciar cuenta atrás automáticamente al completar (check) una serie.  
* **Feedback:** Vibración y sonido (configurable: Bip, Campana, Silencio) al terminar.  
* **Mini-player:** El temporizador flota mientras se navega por la app.

### **4.2. Calculadora de Platos (Plate Calculator)**

* **Configuración de Barra:** Peso de la barra (20kg, 15kg, personalizada).  
* **Inventario:** Configurar qué discos tiene disponibles el usuario (ej: tengo 4 discos de 20kg, pero solo 2 de 10kg).  
* **Visualización:** Gráfico visual de la barra cargada con los discos de colores o estilo "Iron" (negros/naranjas).

### **4.3. Tracker de Peso Corporal (Body Tracker)**

* Registro de peso corporal diario (kg interno, display kg/lbs).  
* Registro de porcentaje de grasa corporal.  
* Gráfico de evolución de peso corporal.  
* Posibilidad de establecer un "Peso Objetivo".

## **5\. Calendario y Planificación**

### **5.1. Vista Mensual**

* Calendario completo donde los días con entrenamiento tienen un indicador (punto naranja).  
* Al tocar un día, despliegue rápido del resumen de entrenamiento (Ejercicios realizados).

### **5.2. Rutinas (Workouts)**

* Posibilidad de guardar una sesión como una "Rutina" (Template).  
* Cargar una rutina en un día vacío.

## **6\. Configuración y Datos (Settings)**

### **6.1. Copia de Seguridad (Backup)**

* **Exportar/Importar:** JSON para restauración completa.
* **Nube:** fuera de alcance en la versión actual.

### **6.2. Preferencias Generales**

* **Unidades:** Métrico (kg/m) vs Imperial (lbs/ft).  
* **Pantalla siempre encendida:** Opción para evitar que el móvil se bloquee durante el entrenamiento.  
* **Tema:** Selección de acentos de color (aunque el default es Naranja IronTrain).

## **7\. UI/UX: La Identidad "IronTrain"**

### **7.1. Paleta de Colores**

La app utiliza una paleta industrial clara (crema/blanco) con texto oscuro y primario marrón/rojo.

### **7.2. Interacciones**

* **Botones Grandes:** Áreas de toque ampliadas para dedos sudorosos o temblorosos post-serie.  
* **Feedback Hártico:** Vibración sutil al marcar una serie como completada.  
* **Sin Animaciones Lentas:** Todas las transiciones deben ser instantáneas (\<100ms). La app debe sentirse "metálica" y rígida, no "gomosa".

## **Resumen de Secciones para Desarrollo**

1. **Core:** Diario, Sets, Tags, Reordering.  
2. **DB:** Gestión de Ejercicios y Categorías Custom.  
3. **Analytics:** Gráficos, 1RM, Breakdown muscular.  
4. **Tools:** Timer Auto, Plate Calc, Bodyweight Tracker.  
5. **Data:** CSV Export, Cloud Backup.  
6. **UI:** IronTrain Theme (Dark/Orange), Haptics.
