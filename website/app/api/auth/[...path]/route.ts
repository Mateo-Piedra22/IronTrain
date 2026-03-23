import { auth } from '../../../../src/lib/auth/server';

const handlers = auth.handler();

/**
 * Proxy de Autenticación con Logging y Resiliencia
 */
async function proxy(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const url = new URL(request.url);
    const serviceUrl = new URL(process.env.NEON_AUTH_SERVICE_URL!);

    url.protocol = serviceUrl.protocol;
    url.host = serviceUrl.host;

    // Limpieza de ruta base
    const basePath = serviceUrl.pathname.replace(/\/$/, '');
    url.pathname = `${basePath}/${path.join('/')}`;

    // Preservar parámetros de búsqueda (?token=, etc)
    url.search = new URL(request.url).search;

    console.log(`[AuthProxy] IN: ${request.url} | OUT: ${url.toString()}`);

    const proxiedRequest = new Request(url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        // Importante para no romper el stream del body si existe
        duplex: 'half'
    } as any);

    const method = request.method as keyof typeof handlers;
    const handler = handlers[method];

    if (typeof handler !== 'function') {
        console.error(`[AuthProxy] Method ${method} not allowed for ${path.join('/')}`);
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const response = await (handler as any)(proxiedRequest, { params: Promise.resolve({ path }) });
        console.log(`[AuthProxy] Result for ${path.join('/')}: ${response.status}`);

        // Estrategia de Silenciamiento para query-fn (Parche para React Query/Proxy conflict)
        if (path[0] === 'query-fn' && response.status === 404) {
            console.log(`[AuthProxy] ✅ Silencing phantom query-fn 404`);
            return new Response(JSON.stringify({}), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return response;
    } catch (error) {
        console.error(`[AuthProxy] CRITICAL ERROR for ${path.join('/')}:`, error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
