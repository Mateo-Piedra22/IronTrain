export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    at: string;
}>;

const MAX_ENTRIES = 500;
let buffer: LogEntry[] = [];

function safeString(value: unknown): string {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function sanitize(val: any): any {
    if (typeof val === 'string') {
        // Redact JWTs (3 parts, roughly matching character set)
        return val.replace(/[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/g, '[JWT_REDACTED]');
    }
    if (val && typeof val === 'object') {
        if (Array.isArray(val)) return val.map(sanitize);
        const copy: any = {};
        for (const key in val) {
            const lowKey = key.toLowerCase();
            if (['token', 'auth', 'password', 'secret', 'code', 'jwt'].some(k => lowKey.includes(k))) {
                copy[key] = '[SENSITIVE_REDACTED]';
            } else {
                copy[key] = sanitize(val[key]);
            }
        }
        return copy;
    }
    return val;
}

function push(entry: Omit<LogEntry, 'at'>): void {
    const sanitizedMsg = sanitize(entry.message);
    const sanitizedCtx = sanitize(entry.context);
    const next: LogEntry = {
        level: entry.level,
        message: sanitizedMsg,
        context: sanitizedCtx,
        at: new Date().toISOString()
    };
    buffer = buffer.length >= MAX_ENTRIES ? [...buffer.slice(1), next] : [...buffer, next];
}

export const logger = {
    debug: (message: string, context?: Record<string, unknown>) => push({ level: 'debug', message, context }),
    info: (message: string, context?: Record<string, unknown>) => push({ level: 'info', message, context }),
    warn: (message: string, context?: Record<string, unknown>) => push({ level: 'warn', message, context }),
    error: (message: string, context?: Record<string, unknown>) => push({ level: 'error', message, context }),

    captureException: (error: unknown, context?: Record<string, unknown>) => {
        const message = safeString(error);
        const safeContext: Record<string, unknown> =
            context && typeof context === 'object' ? context : {};
        push({
            level: 'error',
            message,
            context: {
                ...safeContext,
                errorName: error instanceof Error ? error.name : undefined,
                stack: error instanceof Error ? error.stack : undefined,
            },
        });
    },

    getEntries: (): ReadonlyArray<LogEntry> => buffer,
    clear: (): void => {
        buffer = [];
    },
};
