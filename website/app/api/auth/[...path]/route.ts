import { auth } from '../../../../src/lib/auth/server';

const handlers = auth.handler();
type AuthProxyHandler = (request: Request, context: { params: Promise<{ path: string[] }> }) => Promise<Response>;

function sanitizeCookieDomain(value: string | undefined | null): string | null {
    if (!value) return null;
    const normalized = value.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    if (!normalized) return null;
    if (normalized === 'localhost') return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) return null;
    if (!/^[a-z0-9.-]+$/.test(normalized)) return null;
    if (!normalized.includes('.')) return null;
    return normalized.replace(/^\.+/, '');
}

/**
 * Proxy de Autenticación con Enforzamiento de Dominio
 * Este proxy asegura que las cookies emitidas por Neon tengan el dominio correcto
 * para que el navegador las acepte en irontrain.motiona.xyz.
 */
async function proxy(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const url = new URL(request.url);
    const serviceUrl = new URL(process.env.NEON_AUTH_SERVICE_URL!);

    const basePath = serviceUrl.pathname.replace(/\/$/, '');
    url.pathname = `${basePath}/${path.join('/')}`;
    url.search = new URL(request.url).search;
    url.protocol = serviceUrl.protocol;
    url.host = serviceUrl.host;

    const proxiedRequest = new Request(url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        duplex: 'half'
    } as RequestInit & { duplex: 'half' });

    const method = request.method as keyof typeof handlers;
    const maybeHandler = handlers[method];

    if (typeof maybeHandler !== 'function') {
        return new Response('Method not allowed', { status: 405 });
    }
    const handler = maybeHandler as AuthProxyHandler;

    try {
        const response = await handler(proxiedRequest, { params: Promise.resolve({ path }) });

        // --- LOGICA DE RESCATE: Enforzamos el dominio de las cookies ---
        const newHeaders = new Headers(response.headers);
        const setCookies = response.headers.getSetCookie();

        if (setCookies.length > 0) {
            newHeaders.delete('Set-Cookie');

            const envCookieDomain = sanitizeCookieDomain(process.env.NEON_AUTH_COOKIE_DOMAIN);
            const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
            const requestHost = sanitizeCookieDomain(forwardedHost || new URL(request.url).hostname);
            const cookieDomain = envCookieDomain || requestHost;

            setCookies.forEach((cookie: string) => {
                if (!cookieDomain) {
                    newHeaders.append('Set-Cookie', cookie);
                    return;
                }

                const hasDomain = /;\s*domain=/i.test(cookie);
                const fixedCookie = hasDomain
                    ? cookie.replace(/Domain=[^;]+/i, `Domain=${cookieDomain}`)
                    : `${cookie}; Domain=${cookieDomain}`;
                newHeaders.append('Set-Cookie', fixedCookie);
            });
        }

        // --- MOCK PARA QUERY-FN ---
        if (path[0] === 'query-fn' && response.status === 404) {
            return new Response(JSON.stringify(null), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Clonamos la respuesta con las nuevas cabeceras corregidas
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    } catch (error) {
        console.error(`[AuthProxy] Failure:`, error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
