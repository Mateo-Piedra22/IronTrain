import { auth } from '../../../../src/lib/auth/server';

const handlers = auth.handler();

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
    } as any);

    const method = request.method as keyof typeof handlers;
    const handler = handlers[method];

    if (typeof handler !== 'function') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const response = await (handler as any)(proxiedRequest, { params: Promise.resolve({ path }) });

        // --- LOGICA DE RESCATE: Enforzamos el dominio de las cookies ---
        const newHeaders = new Headers(response.headers);
        const setCookies = response.headers.getSetCookie();

        if (setCookies.length > 0) {
            newHeaders.delete('Set-Cookie');
            // Read domain from env so staging/preview environments work correctly.
            // Falls back to the production domain only if the env var is not set.
            const cookieDomain = process.env.NEON_AUTH_COOKIE_DOMAIN || 'irontrain.motiona.xyz';
            setCookies.forEach((cookie: string) => {
                // Reemplazamos cualquier dominio que venga de Neon por el dominio público de la app
                const fixedCookie = cookie.replace(/Domain=[^;]+/i, `Domain=${cookieDomain}`);
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
