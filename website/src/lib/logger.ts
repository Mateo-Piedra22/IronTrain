export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    at: string;
}>;

const MAX_ENTRIES = 500;
let buffer: LogEntry[] = [];

type SampledOptions = {
    sampleRate: number;
    sampleKey?: string;
    context?: Record<string, unknown>;
};

function safeString(value: unknown): string {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function push(entry: Omit<LogEntry, 'at'>): void {
    const next: LogEntry = { ...entry, at: new Date().toISOString() };
    buffer = buffer.length >= MAX_ENTRIES ? [...buffer.slice(1), next] : [...buffer, next];
}

function stableHash(input: string): number {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function shouldLogSample(sampleRate: number, sampleKey: string): boolean {
    if (sampleRate >= 1) return true;
    if (sampleRate <= 0) return false;
    const ratio = stableHash(sampleKey) / 0xffffffff;
    return ratio < sampleRate;
}

function pushSampled(level: LogLevel, message: string, options: SampledOptions): void {
    const key = options.sampleKey ?? message;
    if (!shouldLogSample(options.sampleRate, key)) return;
    push({ level, message, context: options.context });
}

export const logger = {
    debug: (message: string, context?: Record<string, unknown>) => push({ level: 'debug', message, context }),
    info: (message: string, context?: Record<string, unknown>) => push({ level: 'info', message, context }),
    warn: (message: string, context?: Record<string, unknown>) => push({ level: 'warn', message, context }),
    error: (message: string, context?: Record<string, unknown>) => push({ level: 'error', message, context }),
    infoSampled: (message: string, options: SampledOptions) => pushSampled('info', message, options),
    warnSampled: (message: string, options: SampledOptions) => pushSampled('warn', message, options),
    errorSampled: (message: string, options: SampledOptions) => pushSampled('error', message, options),

    captureException: (error: unknown, context?: Record<string, unknown>) => {
        const message = safeString(error);
        push({
            level: 'error',
            message,
            context: {
                ...context,
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
