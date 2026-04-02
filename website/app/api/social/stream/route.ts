import { NextRequest } from 'next/server';
import { verifyAuth } from '../../../../src/lib/auth';
import { captureServerEvent } from '../../../../src/lib/posthog-server';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';
import { computeSocialPulse } from '../../../../src/lib/social-pulse';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STREAM_INTERVAL_MS = 7000;
const RETRY_MS = 5000;
const MAX_STREAM_DURATION_MS = 5 * 60 * 1000;

const createSecureStreamSessionId = (): string => {
    if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    throw new Error('Secure random UUID generation is unavailable in this runtime');
};

export async function GET(req: NextRequest) {
    const userId = await verifyAuth(req);
    if (!userId) {
        return new Response('Unauthorized', { status: 401 });
    }

    const rateLimit = await RATE_LIMITS.SOCIAL_STREAM(userId);
    if (!rateLimit.ok) {
        return new Response('Too many requests', {
            status: 429,
            headers: {
                'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
            },
        });
    }

    const encoder = new TextEncoder();
    const streamSessionId = createSecureStreamSessionId();

    void captureServerEvent(userId, 'social_stream_connected', {
        stream_session_id: streamSessionId,
        stream_interval_ms: STREAM_INTERVAL_MS,
        max_stream_duration_ms: MAX_STREAM_DURATION_MS,
    }).catch(() => undefined);

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;
            let interval: ReturnType<typeof setInterval> | null = null;
            let maxDurationTimeout: ReturnType<typeof setTimeout> | null = null;
            let lastVersion: string | null = null;
            let lastPulse: Awaited<ReturnType<typeof computeSocialPulse>> | null = null;
            let emittedPulseCount = 0;
            let emittedHeartbeatCount = 0;
            let emitErrorCount = 0;
            const startedAtMs = Date.now();

            const push = (chunk: string) => {
                if (closed) return;
                controller.enqueue(encoder.encode(chunk));
            };

            const sendEvent = (event: string, payload: unknown) => {
                push(`event: ${event}\n`);
                push(`data: ${JSON.stringify(payload)}\n\n`);
            };

            const close = () => {
                if (closed) return;
                closed = true;
                if (interval) {
                    clearInterval(interval);
                    interval = null;
                }
                if (maxDurationTimeout) {
                    clearTimeout(maxDurationTimeout);
                    maxDurationTimeout = null;
                }
                try {
                    controller.close();
                } catch {
                    // no-op
                }

                void captureServerEvent(userId, 'social_stream_closed', {
                    stream_session_id: streamSessionId,
                    stream_duration_ms: Date.now() - startedAtMs,
                    pulses_sent: emittedPulseCount,
                    heartbeats_sent: emittedHeartbeatCount,
                    emit_errors: emitErrorCount,
                }).catch(() => undefined);
            };

            req.signal.addEventListener('abort', close);

            const emitPulse = async () => {
                if (closed) return;
                try {
                    const pulse = await computeSocialPulse(userId);
                    if (pulse.version !== lastVersion) {
                        if (lastPulse) {
                            if (pulse.latestThemeRatingAtMs !== lastPulse.latestThemeRatingAtMs) {
                                sendEvent('theme.rating.updated', {
                                    atMs: pulse.latestThemeRatingAtMs,
                                    version: pulse.domainVersions.themes,
                                });
                            }

                            if (pulse.latestThemeFeedbackAtMs !== lastPulse.latestThemeFeedbackAtMs) {
                                sendEvent('theme.feedback.created', {
                                    atMs: pulse.latestThemeFeedbackAtMs,
                                    version: pulse.domainVersions.themes,
                                });
                            }

                            if (pulse.latestThemePackAtMs !== lastPulse.latestThemePackAtMs) {
                                sendEvent('theme.updated', {
                                    atMs: pulse.latestThemePackAtMs,
                                    version: pulse.domainVersions.themes,
                                });
                            }

                            if (pulse.latestThemeReportAtMs !== lastPulse.latestThemeReportAtMs) {
                                sendEvent('theme.moderation.changed', {
                                    atMs: pulse.latestThemeReportAtMs,
                                    version: pulse.domainVersions.themes,
                                });
                            }
                        }

                        lastVersion = pulse.version;
                        lastPulse = pulse;
                        emittedPulseCount += 1;
                        sendEvent('pulse', pulse);
                    } else {
                        emittedHeartbeatCount += 1;
                        sendEvent('heartbeat', {
                            version: lastVersion,
                            serverTimeMs: Date.now(),
                        });
                    }
                } catch {
                    emitErrorCount += 1;
                    emittedHeartbeatCount += 1;
                    sendEvent('heartbeat', {
                        version: lastVersion,
                        serverTimeMs: Date.now(),
                    });
                }
            };

            push(`retry: ${RETRY_MS}\n\n`);
            sendEvent('ready', { serverTimeMs: Date.now() });
            void emitPulse();

            interval = setInterval(() => {
                void emitPulse();
            }, STREAM_INTERVAL_MS);

            maxDurationTimeout = setTimeout(() => {
                close();
            }, MAX_STREAM_DURATION_MS);
        },
        cancel() {
            // no-op
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-store, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
