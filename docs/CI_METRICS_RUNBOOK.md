# CI Metrics Runbook

## Objective

Track platform health for CI/CD with a biweekly review cadence and quarterly improvement planning.

## Source of truth

- Workflow: `.github/workflows/engineering-metrics.yml`
- Output artifact: `engineering-metrics-<run_id>`
- Report file inside artifact: `docs/metrics/engineering-metrics-<YYYY-MM-DD>.md`

## KPIs

- CI fail rate
- Median CI duration (minutes)
- Flaky run indicator (re-runs/attempts)
- Median PR time-to-merge (hours)

## Review cadence

- Biweekly review: every 1st and 15th day (UTC)
- Quarterly planning: analyze trend and define top 3 reliability actions

## Biweekly checklist

- [ ] Download latest engineering metrics artifact
- [ ] Compare fail rate against previous period
- [ ] Compare median CI duration against previous period
- [ ] Compare PR time-to-merge against previous period
- [ ] Capture top 3 incidents (if any)
- [ ] Open improvement issues with owners and due dates

## Quarterly checklist

- [ ] Consolidate 3 months of metrics
- [ ] Identify recurring bottlenecks
- [ ] Define next quarter SLO targets
- [ ] Prioritize automation and test improvements
- [ ] Publish roadmap update in `docs/` and planning board
