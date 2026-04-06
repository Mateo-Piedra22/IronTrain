import { Config } from '../constants/Config';
import { ThemeColorPatch } from '../theme-engine';

export class ThemeImportError extends Error {
    status?: number;
    code?: string;
    retryAfterSeconds?: number;

    constructor(message: string, options?: { status?: number; code?: string; retryAfterSeconds?: number }) {
        super(message);
        this.name = 'ThemeImportError';
        this.status = options?.status;
        this.code = options?.code;
        this.retryAfterSeconds = options?.retryAfterSeconds;
    }
}

export interface SharedThemePayload {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    tags: string[];
    supportsLight: boolean;
    supportsDark: boolean;
    version: number;
    payload: {
        schemaVersion?: number;
        lightPatch?: ThemeColorPatch;
        darkPatch?: ThemeColorPatch;
        preview?: Record<string, string>;
        meta?: Record<string, unknown>;
    };
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const readError = (body: unknown, fallback: string): string => {
    if (isRecord(body)) {
        if (typeof body.error === 'string' && body.error.trim().length > 0) return body.error;
        if (typeof body.message === 'string' && body.message.trim().length > 0) return body.message;
    }
    return fallback;
};

const normalizePayload = (raw: unknown): SharedThemePayload => {
    if (!isRecord(raw)) {
        throw new ThemeImportError('Respuesta inválida del servidor de themes.');
    }

    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const slug = typeof raw.slug === 'string' ? raw.slug.trim() : '';
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';

    if (!id || !slug || !name) {
        throw new ThemeImportError('El theme compartido no tiene identidad válida.');
    }

    const supportsLight = raw.supportsLight === true;
    const supportsDark = raw.supportsDark === true;

    if (!supportsLight && !supportsDark) {
        throw new ThemeImportError('El theme no declara compatibilidad Light/Dark.');
    }

    const payload = isRecord(raw.payload) ? raw.payload : {};
    const tags = Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 16) : [];

    return {
        id,
        slug,
        name,
        description: typeof raw.description === 'string' ? raw.description : null,
        tags,
        supportsLight,
        supportsDark,
        version: typeof raw.version === 'number' && Number.isFinite(raw.version) ? raw.version : 1,
        payload: {
            schemaVersion: typeof payload.schemaVersion === 'number' ? payload.schemaVersion : undefined,
            lightPatch: isRecord(payload.lightPatch) ? payload.lightPatch as ThemeColorPatch : {},
            darkPatch: isRecord(payload.darkPatch) ? payload.darkPatch as ThemeColorPatch : {},
            preview: isRecord(payload.preview) ? payload.preview as Record<string, string> : {},
            meta: isRecord(payload.meta) ? payload.meta : {},
        },
    };
};

export class ThemeImportService {
    static async fetchSharedThemeBySlug(slug: string, timeoutMs = 15000): Promise<SharedThemePayload> {
        const normalizedSlug = slug.trim();
        if (!normalizedSlug) {
            throw new ThemeImportError('Slug de theme inválido.', { code: 'invalid_slug' });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const endpoint = `${Config.API_URL}/api/share/theme/${encodeURIComponent(normalizedSlug)}`;
            const response = await fetch(endpoint, { method: 'GET', signal: controller.signal });

            const retryAfterHeader = response.headers.get('Retry-After');
            const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;

            let body: unknown = {};
            try {
                body = await response.json();
            } catch {
                body = {};
            }

            if (!response.ok) {
                if (response.status === 404) {
                    throw new ThemeImportError('El theme no está disponible o fue removido.', {
                        status: response.status,
                        code: 'not_found',
                    });
                }

                if (response.status === 429) {
                    throw new ThemeImportError('Límite de solicitudes alcanzado. Intentá de nuevo en unos segundos.', {
                        status: response.status,
                        code: 'rate_limited',
                        retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
                    });
                }

                throw new ThemeImportError(readError(body, 'No se pudo establecer conexión con IronTrain.'), {
                    status: response.status,
                });
            }

            if (!isRecord(body) || body.success !== true || !('data' in body)) {
                throw new ThemeImportError(readError(body, 'Respuesta inválida del servidor de themes.'));
            }

            return normalizePayload(body.data);
        } catch (error: unknown) {
            if (error instanceof ThemeImportError) throw error;

            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new ThemeImportError('La solicitud tardó demasiado. Verificá tu conexión e intentá nuevamente.', {
                    code: 'timeout',
                });
            }

            throw new ThemeImportError('No se pudo conectar con IronTrain. Verificá tu conexión e intentá nuevamente.', {
                code: 'network_error',
            });
        } finally {
            clearTimeout(timeout);
        }
    }
}
