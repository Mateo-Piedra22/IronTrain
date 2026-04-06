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

function shouldRewriteCookieDomain(cookie: string): boolean {
    const [namePart = ''] = cookie.split(';', 1);
    const cookieName = namePart.split('=')[0]?.trim() || '';

    // Reescribimos SOLO cookies locales de sesión Neon.
    // Cualquier cookie de OAuth state/challenge del upstream debe conservar dominio original,
    // porque Google vuelve al dominio de Neon Auth para validar estado.
    return /^(__Secure-|__Host-)?neon-auth\./i.test(cookieName)
        || /^__Secure-neon-auth\./i.test(cookieName)
        || /^neon-auth\./i.test(cookieName);
}

function isOAuthCriticalPath(path: string[]): boolean {
    const normalized = path.join('/').toLowerCase();
    return normalized.includes('sign-in/social')
        || normalized.includes('link-social')
        || normalized.includes('callback')
        || normalized.includes('oauth');
}

/**
 * Proxy de Autenticación con Enforzamiento de Dominio
 * Este proxy asegura que las cookies emitidas por Neon tengan el dominio correcto
 * para que el navegador las acepte en irontrain.motiona.xyz.
 */
async function proxy(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const oauthCritical = isOAuthCriticalPath(path);

    const method = request.method as keyof typeof handlers;
    const maybeHandler = handlers[method];

    if (typeof maybeHandler !== 'function') {
        return new Response('Method not allowed', { status: 405 });
    }
    const handler = maybeHandler as AuthProxyHandler;

    try {
        // IMPORTANT:
        // We must pass the ORIGINAL incoming request here.
        // createNeonAuth().handler() already proxies upstream using configured baseUrl and
        // manages OAuth challenge/state cookies. Rewriting request.url beforehand can break state validation.
        const response = await handler(request, { params: Promise.resolve({ path }) });

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
                if (oauthCritical || !cookieDomain || !shouldRewriteCookieDomain(cookie)) {
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
