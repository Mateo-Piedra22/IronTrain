import { NextRequest, NextResponse } from 'next/server';
import { getAdminContext, hasAdminRole, writeAdminAuditLog } from '../../../../../src/lib/admin-security';
import { verifyAuth } from '../../../../../src/lib/auth';
import { auth } from '../../../../../src/lib/auth/server';
import { RATE_LIMITS } from '../../../../../src/lib/rate-limit';
import { getSyncHealthReport } from '../../../../../src/lib/sync-health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

const STREAM_INTERVAL_MS = 8000;
const MAX_STREAM_DURATION_MS = 5 * 60 * 1000;
const RETRY_MS = 5000;

function isAdminUser(userId: string): boolean {
    return ADMIN_USER_IDS.includes(userId);
}

function createSessionId(): string {
    if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function GET(req: NextRequest) {
    let userId: string | null = null;

    try {
        try {
            const { data } = await auth.getSession();
            userId = data?.user?.id ?? null;
        } catch {
            userId = null;
        }

        if (!userId) userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!isAdminUser(userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const adminCtx = await getAdminContext();
        if (!adminCtx || adminCtx.userId !== userId || !hasAdminRole(adminCtx.role, 'viewer')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const rate = await RATE_LIMITS.ADMIN_ACTION(userId);
        if (!rate.ok) {
            return NextResponse.json(
                { error: 'Too many admin requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rate.resetAtMs - Date.now()) / 1000)),
                    },
                }
            );
        }

        const encoder = new TextEncoder();
        const streamSessionId = createSessionId();

        await writeAdminAuditLog({
            adminUserId: adminCtx.userId,
            adminRole: adminCtx.role,
            action: 'admin.api.sync-health.stream.start',
            status: 'success',
            metadata: { streamSessionId, streamIntervalMs: STREAM_INTERVAL_MS },
        });

        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                let closed = false;
                let interval: ReturnType<typeof setInterval> | null = null;
                let timeout: ReturnType<typeof setTimeout> | null = null;
                let lastFingerprint = '';

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
                    if (interval) clearInterval(interval);
                    if (timeout) clearTimeout(timeout);
                    try {
                        controller.close();
                    } catch {
                        // no-op
                    }
                };

                req.signal.addEventListener('abort', close);

                const emitHealth = async () => {
                    if (closed) return;
                    try {
                        const report = await getSyncHealthReport();
                        const fingerprint = JSON.stringify({
                            generatedAt: report.generatedAt,
                            dbOk: report.db.ok,
                            txMode: report.transaction.mode,
                            operations: report.operations,
                            signals: report.signals,
                        });

                        if (fingerprint !== lastFingerprint) {
                            lastFingerprint = fingerprint;
                            sendEvent('health.delta', {
                                ts: Date.now(),
                                report,
                            });
                        } else {
                            sendEvent('heartbeat', {
                                ts: Date.now(),
                                mode: report.transaction.mode,
                            });
                        }
                    } catch (error) {
                        sendEvent('heartbeat', {
                            ts: Date.now(),
                            error: true,
                        });
                    }
                };

                push(`retry: ${RETRY_MS}\n\n`);
                sendEvent('ready', { ts: Date.now(), streamSessionId });
                void emitHealth();

                interval = setInterval(() => {
                    void emitHealth();
                }, STREAM_INTERVAL_MS);

                timeout = setTimeout(() => {
                    close();
                }, MAX_STREAM_DURATION_MS);
            },
            cancel() {
                // no-op
            },
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-store, no-transform',
                Connection: 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        });
    } catch (error) {
        if (userId) {
            const adminCtx = await getAdminContext().catch(() => null);
            await writeAdminAuditLog({
                adminUserId: userId,
                adminRole: adminCtx?.role ?? 'viewer',
                action: 'admin.api.sync-health.stream.start',
                status: 'error',
                message: error instanceof Error ? error.message : 'Unknown stream error',
            }).catch(() => undefined);
        }

        return NextResponse.json({ error: 'Failed to open sync-health stream' }, { status: 500 });
    }
}
