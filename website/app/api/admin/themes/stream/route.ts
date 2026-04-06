import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { writeAdminAuditLog } from '../../../../../src/lib/admin-security';
import { resolveAdminApiContext } from '../_auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STREAM_INTERVAL_MS = 8000;
const MAX_STREAM_DURATION_MS = 5 * 60 * 1000;
const RETRY_MS = 5000;

function createSessionId(): string {
    if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

type ThemesStreamSnapshot = {
    pendingReviewCount: number;
    openReportsCount: number;
    latestThemeUpdateAt: string | null;
    latestReportUpdateAt: string | null;
};

async function getThemesStreamSnapshot(): Promise<ThemesStreamSnapshot> {
    const [pendingRows, reportRows, latestThemeRows, latestReportRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` })
            .from(schema.themePacks)
            .where(and(eq(schema.themePacks.status, 'pending_review'), isNull(schema.themePacks.deletedAt))),
        db.select({ count: sql<number>`count(*)::int` })
            .from(schema.themePackReports)
            .where(eq(schema.themePackReports.status, 'open')),
        db.select({ latest: sql<Date | null>`max(${schema.themePacks.updatedAt})` })
            .from(schema.themePacks)
            .where(isNull(schema.themePacks.deletedAt)),
        db.select({ latest: sql<Date | null>`max(${schema.themePackReports.updatedAt})` })
            .from(schema.themePackReports),
    ]);

    return {
        pendingReviewCount: Number(pendingRows[0]?.count || 0),
        openReportsCount: Number(reportRows[0]?.count || 0),
        latestThemeUpdateAt: latestThemeRows[0]?.latest ? new Date(latestThemeRows[0].latest).toISOString() : null,
        latestReportUpdateAt: latestReportRows[0]?.latest ? new Date(latestReportRows[0].latest).toISOString() : null,
    };
}

export async function GET(req: NextRequest) {
    const adminResult = await resolveAdminApiContext(req, 'moderator');
    if (!adminResult.ok) return adminResult.response;

    const encoder = new TextEncoder();
    const streamSessionId = createSessionId();

    await writeAdminAuditLog({
        adminUserId: adminResult.admin.userId,
        adminRole: adminResult.admin.role,
        action: 'admin.api.themes.stream.start',
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

            const emitSnapshot = async () => {
                if (closed) return;
                try {
                    const snapshot = await getThemesStreamSnapshot();
                    const fingerprint = JSON.stringify(snapshot);
                    if (fingerprint !== lastFingerprint) {
                        lastFingerprint = fingerprint;
                        sendEvent('theme.queue.changed', {
                            ts: Date.now(),
                            snapshot,
                        });
                    } else {
                        sendEvent('heartbeat', {
                            ts: Date.now(),
                        });
                    }
                } catch {
                    sendEvent('heartbeat', {
                        ts: Date.now(),
                        error: true,
                    });
                }
            };

            push(`retry: ${RETRY_MS}\n\n`);
            sendEvent('ready', { ts: Date.now(), streamSessionId });
            void emitSnapshot();

            interval = setInterval(() => {
                void emitSnapshot();
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
}
