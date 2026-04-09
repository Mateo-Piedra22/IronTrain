# Optimization KPI Dashboard — Fase 0

## Objetivo
Definir un dashboard operativo para validar las optimizaciones por dominio (`sync`, `social`, `timer`, `update`, `db`) y habilitar baseline comparativo.

## Eventos instrumentados
- `opt_sync_scheduler_init`
- `opt_sync_scheduler_request`
- `opt_sync_scheduler_run_started`
- `opt_sync_scheduler_run_succeeded`
- `opt_sync_scheduler_run_skipped`
- `opt_sync_scheduler_run_failed`
- `opt_social_realtime_focus_start`
- `opt_social_realtime_focus_stop`
- `opt_timer_started`
- `opt_timer_stopped`
- `opt_timer_loop_started`
- `opt_timer_loop_stopped`
- `opt_timer_inconsistent_state`
- `opt_update_service_init`
- `opt_update_check_started`
- `opt_update_check_succeeded`
- `opt_update_check_failed`
- `opt_db_query_timing`

## Widgets mínimos del dashboard
1. **Requests/min por dominio**
   - Fuente: eventos `opt_sync_scheduler_*`, `opt_update_check_*`, y eventos social existentes.
2. **Wakeups/min (loops activos)**
   - Fuente: `opt_timer_loop_started/stopped`, `opt_social_realtime_focus_start/stop`.
3. **p50/p95 de latencia DB**
   - Fuente: `opt_db_query_timing.elapsed_ms` filtrando `failed=false`.
4. **Error/retry rate por dominio**
   - Fuente: `opt_sync_scheduler_run_failed`, `opt_update_check_failed`, `opt_db_query_timing.failed=true`.
5. **Eficiencia de dedupe/coalescing**
   - Fuente: `opt_sync_scheduler_request` vs `opt_sync_scheduler_run_started`.

## Filtros recomendados
- `platform = mobile`
- `app_version`
- `scheduler_v2_enabled`, `social_realtime_v2_enabled`, `timer_unified_v1_enabled`

## Protocolo baseline
- Ventana mínima: 72 horas.
- Cohortes:
  - Cohorte A: flags OFF.
  - Cohorte B: flags ON por dominio.
- Cierre de baseline:
  - Variación estable (sin picos anómalos en últimas 24h).
  - Volumen de eventos suficiente en dominios críticos.

## Rollback por flag (runbook rápido)
1. Detectar degradación por dominio en dashboard.
2. Desactivar flag puntual:
   - `opt.sync.scheduler.v2`
   - `opt.social.realtime.v2`
   - `opt.timer.unified.v1`
   - `opt.diary.incremental_refresh.v1`
   - `opt.analysis.lazy_loading.v1`
3. Verificar recuperación de métricas en 15–30 minutos.
4. Mantener incidente abierto con evidencia before/after.
5. Rehabilitar solo tras corrección y validación en cohorte controlada.
