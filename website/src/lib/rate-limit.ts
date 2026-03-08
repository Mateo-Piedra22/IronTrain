type RateLimitState = {
    count: number;
    resetAtMs: number;
};

const buckets = new Map<string, RateLimitState>();

export type RateLimitResult =
    | { ok: true; remaining: number; resetAtMs: number }
    | { ok: false; remaining: 0; resetAtMs: number };

export function checkRateLimit(params: {
    key: string;
    limit: number;
    windowMs: number;
    nowMs?: number;
}): RateLimitResult {
    const nowMs = params.nowMs ?? Date.now();
    const limit = Math.max(1, Math.floor(params.limit));
    const windowMs = Math.max(250, Math.floor(params.windowMs));

    const current = buckets.get(params.key);

    if (!current || nowMs >= current.resetAtMs) {
        const resetAtMs = nowMs + windowMs;
        const next: RateLimitState = { count: 1, resetAtMs };
        buckets.set(params.key, next);
        return { ok: true, remaining: Math.max(0, limit - 1), resetAtMs };
    }

    if (current.count >= limit) {
        return { ok: false, remaining: 0, resetAtMs: current.resetAtMs };
    }

    current.count += 1;
    buckets.set(params.key, current);
    return { ok: true, remaining: Math.max(0, limit - current.count), resetAtMs: current.resetAtMs };
}

export function _unsafeClearRateLimitBucketsForTests(): void {
    buckets.clear();
}
