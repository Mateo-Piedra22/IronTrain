const BASE_URL = process.env.THEMES_LOAD_BASE_URL ?? 'http://localhost:3000';
const TOKEN = process.env.THEMES_LOAD_TOKEN ?? '';
const THEME_ID = process.env.THEMES_LOAD_THEME_ID ?? '';
const ITERATIONS = Number(process.env.THEMES_LOAD_ITERATIONS ?? 25);
const CONCURRENCY = Number(process.env.THEMES_LOAD_CONCURRENCY ?? 4);

if (!TOKEN) {
    console.error('Missing THEMES_LOAD_TOKEN');
    process.exit(1);
}

const headers = {
    Authorization: `Bearer ${TOKEN}`,
    'content-type': 'application/json',
};

function percentile(values, p) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    if (p <= 0) return sorted[0];
    if (p >= 100) return sorted[sorted.length - 1];

    const rank = (p / 100) * (sorted.length - 1);
    const lowerIndex = Math.floor(rank);
    const upperIndex = Math.ceil(rank);
    if (lowerIndex === upperIndex) return sorted[lowerIndex];

    const weight = rank - lowerIndex;
    return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * weight;
}

function summarize(name, samples) {
    const latencies = samples.map((sample) => sample.durationMs);
    const byStatus = samples.reduce((acc, sample) => {
        acc[sample.status] = (acc[sample.status] ?? 0) + 1;
        return acc;
    }, {});

    const avg = latencies.length
        ? latencies.reduce((acc, current) => acc + current, 0) / latencies.length
        : null;

    return {
        name,
        requests: samples.length,
        avgMs: avg ? Number(avg.toFixed(2)) : null,
        p95Ms: percentile(latencies, 95),
        statusBreakdown: byStatus,
    };
}

async function runScenario(name, requestFactory) {
    const samples = [];
    let cursor = 0;

    async function worker() {
        while (cursor < ITERATIONS) {
            const current = cursor;
            cursor += 1;
            const req = requestFactory(current);

            const startedAt = Date.now();
            let status = 0;

            try {
                const response = await fetch(req.url, {
                    method: req.method,
                    headers,
                    body: req.body,
                });
                status = response.status;
                await response.text();
            } catch {
                status = 0;
            }

            const durationMs = Date.now() - startedAt;
            samples.push({ status, durationMs });
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    return summarize(name, samples);
}

async function main() {
    const scenarios = [
        {
            name: 'list',
            requestFactory: () => ({
                method: 'GET',
                url: `${BASE_URL}/api/social/themes?page=1&pageSize=10&sort=trending`,
            }),
        },
    ];

    if (THEME_ID) {
        scenarios.push(
            {
                name: 'detail',
                requestFactory: () => ({
                    method: 'GET',
                    url: `${BASE_URL}/api/social/themes/${THEME_ID}`,
                }),
            },
            {
                name: 'install',
                requestFactory: () => ({
                    method: 'POST',
                    url: `${BASE_URL}/api/social/themes/${THEME_ID}/install`,
                    body: JSON.stringify({ appliedLight: true, appliedDark: false }),
                }),
            },
            {
                name: 'rate',
                requestFactory: (index) => ({
                    method: 'POST',
                    url: `${BASE_URL}/api/social/themes/${THEME_ID}/rate`,
                    body: JSON.stringify({ rating: (index % 5) + 1, review: 'load-test' }),
                }),
            },
            {
                name: 'report',
                requestFactory: () => ({
                    method: 'POST',
                    url: `${BASE_URL}/api/social/themes/${THEME_ID}/report`,
                    body: JSON.stringify({ reason: 'abuse', details: 'load-test' }),
                }),
            },
        );
    }

    const results = [];
    for (const scenario of scenarios) {
        const summary = await runScenario(scenario.name, scenario.requestFactory);
        results.push(summary);
    }

    console.table(results.map((result) => ({
        scenario: result.name,
        requests: result.requests,
        avgMs: result.avgMs,
        p95Ms: result.p95Ms,
        statuses: JSON.stringify(result.statusBreakdown),
    })));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
