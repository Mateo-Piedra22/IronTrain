# IronSocial Backlog Ejecutable (Sin Digest Semanal)

Fecha: 2026-03-31
Alcance: Frontend móvil (Expo/React Native) + Backend (Next.js + Neon/Drizzle)
Exclusión explícita: No incluir funcionalidad de digest semanal.

## 1) Supuestos de planificación

- Equipo mínimo recomendado por sprint: 1 FE + 1 BE + 1 QA (parcial) + 1 PM/Tech Lead.
- Duración de sprint: 2 semanas.
- Definición de hecho (DoD):
  - Feature behind flag (cuando aplique)
  - Telemetría mínima de uso y errores
  - Tests básicos (unit + integración en backend, smoke UI en frontend)
  - Typecheck y lint en verde
  - Documentación de comportamiento

## 2) Épicas priorizadas

### Épica A — Feed Inteligente v1

**Objetivo:** Priorizar contenido relevante para aumentar sesiones útiles y reducir “scroll vacío”.

#### Historia A1 (BE): Ranking de feed por relevancia

- Como usuario, quiero ver primero actividad más relevante para mí.
- Alcance técnico:
  - Endpoint `GET /social/feed?cursor=&scope=friends|all`
  - Score inicial por: recencia, relación social (amigo/no amigo), tipo de evento (PR > workout > share), interacción previa.
  - Paginación por cursor.
- Criterios de aceptación:
  - Dado un conjunto mixto, los items se retornan ordenados por score descendente y recencia como desempate.
  - El endpoint soporta paginación estable sin duplicados entre páginas.
  - P95 endpoint < 300ms con dataset de staging.
- Estimación: 5 puntos.
- Dependencias: índice DB en `created_at`, `sender_id`, `action_type`.

#### Historia A2 (FE): UI de feed con scope y orden transparente

- Como usuario, quiero controlar el scope del feed para no perder contexto.
- Alcance técnico:
  - Selector “Mi red / Comunidad” + persistencia local de preferencia.
  - Indicador no intrusivo de criterio de orden (“Relevancia”).
- Criterios de aceptación:
  - El selector no reinicia scroll al cambiar de scope (usa cache por scope).
  - Se mantiene preferencia al reabrir app.
- Estimación: 3 puntos.
- Dependencias: A1.

#### Historia A3 (QA/Analytics): Telemetría de efectividad del ranking

- Eventos:
  - `social_feed_impression`
  - `social_feed_item_open`
  - `social_feed_kudo`
  - `social_feed_hide_item`
- Criterios de aceptación:
  - Dashboard básico con CTR por posición del item.
- Estimación: 2 puntos.

---

### Épica B — Comentarios Reales + Menciones

**Objetivo:** Convertir interacciones pasivas en conversación útil.

#### Historia B1 (BE): Modelo de comentarios

- Tablas:
  - `social_comments(id, activity_id, author_id, body, created_at, deleted_at)`
  - `social_comment_mentions(comment_id, mentioned_user_id)`
- Criterios de aceptación:
  - CRUD básico (create/list/delete propio).
  - Sanitización y límite de longitud.
- Estimación: 5 puntos.

#### Historia B2 (BE): Resolución de menciones y notificaciones

- Detección de `@username` al crear comentario.
- Fanout de notificación para usuarios mencionados.
- Criterios de aceptación:
  - Si el usuario existe y no está bloqueado/muteado, recibe notificación.
- Estimación: 3 puntos.
- Dependencias: B1 + Épica D (confianza) parcial.

#### Historia B3 (FE): Hilo de comentarios en ActivityCard

- Modal/bottom sheet con lista + composer.
- Estado optimista al enviar comentario.
- Criterios de aceptación:
  - Crear comentario actualiza UI sin refresh manual.
  - Menciones se resaltan visualmente.
- Estimación: 5 puntos.
- Dependencias: B1/B2.

---

### Épica C — Objetivos Sociales + Retos

**Objetivo:** Aumentar constancia y motivación con mecánicas acotadas y confiables.

#### Historia C1 (BE): Objetivos sociales semanales

- Crear objetivo personal o en dupla (por cantidad de entrenos o PRs).
- Criterios de aceptación:
  - Estado de progreso recalculado al registrar actividad elegible.
- Estimación: 5 puntos.

#### Historia C2 (FE): Vista de objetivos en Social

- Card de objetivo activo + progreso + CTA para crear/editar.
- Criterios de aceptación:
  - Muestra progreso correcto y estado (en curso/completado/vencido).
- Estimación: 3 puntos.
- Dependencias: C1.

#### Historia C3 (BE): Retos temporales con validaciones básicas

- Tipos iniciales: `workout_count`, `streak_days`, `pr_count`.
- Ventana temporal y elegibilidad.
- Criterios de aceptación:
  - Actividad fuera de ventana no suma.
  - Idempotencia de scoring por actividad.
- Estimación: 8 puntos.

#### Historia C4 (FE): UI de retos activos/finalizados

- Lista de retos + estado + ranking de reto.
- Criterios de aceptación:
  - Actualización en tiempo casi real al completar actividad.
- Estimación: 5 puntos.
- Dependencias: C3.

---

### Épica D — Confianza y Seguridad Social

**Objetivo:** Reducir fricción social y abuso, manteniendo experiencia segura.

#### Historia D1 (BE): Bloquear/silenciar/reportar

- Tabla de relaciones de moderación por usuario.
- Reglas de visibilidad en feed/comentarios/notificaciones.
- Criterios de aceptación:
  - Usuario bloqueado no aparece en feed ni puede interactuar.
- Estimación: 5 puntos.

#### Historia D2 (FE): Controles de seguridad en perfil y acciones

- Acciones en perfil: Bloquear, Silenciar, Reportar.
- Criterios de aceptación:
  - Acción efectiva reflejada al instante en UI (optimista + rollback).
- Estimación: 3 puntos.
- Dependencias: D1.

#### Historia D3 (BE/QA): Cola de reportes para revisión admin

- Endpoint admin para listar/accionar reportes.
- Criterios de aceptación:
  - Estados: nuevo/en revisión/resuelto.
- Estimación: 3 puntos.

---

### Épica E — Recomendador de Partners

**Objetivo:** Sugerir conexiones útiles para entrenar mejor y sostener uso.

#### Historia E1 (BE): Scoring de compatibilidad

- Señales: frecuencia semanal, horarios aproximados, objetivos, nivel.
- Criterios de aceptación:
  - Top-N recomendaciones por usuario con explicación breve.
- Estimación: 5 puntos.

#### Historia E2 (FE): Módulo “Sugeridos para entrenar”

- Tarjetas de sugeridos con CTA (seguir/agregar).
- Criterios de aceptación:
  - Conversión a solicitud medible por evento analítico.
- Estimación: 3 puntos.
- Dependencias: E1.

---

### Épica F — Colecciones Colaborativas + Perfil Avanzado

**Objetivo:** Pasar de interacción a colaboración y mostrar progreso significativo.

#### Historia F1 (BE): Colecciones colaborativas de rutinas

- Entidades: colección, miembros, permisos (owner/editor/viewer).
- Criterios de aceptación:
  - Edición concurrente básica sin corrupción de datos.
- Estimación: 8 puntos.

#### Historia F2 (FE): UI de colección compartida

- Crear/invitar/editar/duplicar rutina dentro de colección.
- Criterios de aceptación:
  - Cambios visibles al resto de miembros tras sync.
- Estimación: 8 puntos.
- Dependencias: F1.

#### Historia F3 (BE+FE): Perfil social avanzado

- Métricas: consistencia 4/8 semanas, hit rate de objetivos, PR trend.
- Criterios de aceptación:
  - Métricas consistentes entre vista perfil y ranking.
- Estimación: 5 puntos.

## 3) Plan de sprints sugerido

### Sprint 1

- A1, A2, A3
- Resultado esperado: Feed inteligente v1 productivo con observabilidad.

### Sprint 2

- B1, B2, B3
- Resultado esperado: Comentarios y menciones operativas.

### Sprint 3

- D1, D2, D3
- Resultado esperado: Base sólida de seguridad social.

### Sprint 4

- C1, C2
- Resultado esperado: Objetivos sociales semanales funcionales.

### Sprint 5

- C3, C4
- Resultado esperado: Retos temporales end-to-end.

### Sprint 6

- E1, E2
- Resultado esperado: Recomendador de partners y funnel medible.

### Sprint 7-8

- F1, F2, F3
- Resultado esperado: Colaboración de rutinas y perfil avanzado.

## 4) Dependencias técnicas transversales

- Migraciones DB:
  - comments, mentions, moderation, challenges, collaborative collections.
- Indexado recomendado:
  - actividad por `created_at`, `sender_id`, `action_type`.
  - comentarios por `activity_id`, `created_at`.
- Flags de feature:
  - `social.feed_ranking_v1`
  - `social.comments_v1`
  - `social.safety_controls`
  - `social.challenges_v1`
  - `social.partner_reco_v1`
  - `social.collections_v1`

## 5) Riesgos + mitigación

- Riesgo: complejidad de ranking y sesgo de relevancia.
  - Mitigación: rollout gradual por cohortes + métricas de calidad.
- Riesgo: abuso en comentarios/menciones.
  - Mitigación: límites por rate + report/mute/block desde día 1.
- Riesgo: carga backend por fanout de notificaciones.
  - Mitigación: cola asíncrona y reintentos con idempotencia.
- Riesgo: UX saturada en social tab.
  - Mitigación: progressive disclosure + acciones contextuales.

## 6) KPI por épica

- Feed inteligente: CTR por posición, tiempo útil de sesión social, retorno D7.
- Comentarios/menciones: comentarios por usuario activo, tasa de respuesta.
- Objetivos/retos: tasa de finalización semanal, streak medio.
- Seguridad: tasa de reportes resueltos, reducción de bloqueos repetidos.
- Partners: tasa de solicitud desde sugeridos, aceptación.
- Colaboración/perfil: colecciones activas por semana, rutinas co-editadas.

## 7) Entregables por historia (plantilla)

Cada historia debe incluir:

- API contract (request/response)
- Casos edge documentados
- Tests automatizados mínimos
- Eventos analíticos
- Checklist de release + rollback

---

Este backlog está pensado para ejecución incremental, con valor visible cada sprint y sin incluir digest semanal.
