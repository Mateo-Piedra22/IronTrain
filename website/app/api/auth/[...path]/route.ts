import { auth } from '../../../../src/lib/auth/server';

const handlers = auth.handler();

/**
 * Proxy de Autenticación con Inspección de Datos
 */
async function proxy(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const url = new URL(request.url);
    const serviceUrl = new URL(process.env.NEON_AUTH_SERVICE_URL!);

    // Limpieza de ruta base
    const basePath = serviceUrl.pathname.replace(/\/$/, '');
    url.pathname = `${basePath}/${path.join('/')}`;
    url.search = new URL(request.url).search;

    console.log(`[AuthProxy] REQ: ${path.join('/')} -> ${url.host}`);

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

        // --- LOGICA DE RESCATE PARA UI DESAPARECIDA ---
        if (path[0] === 'get-session') {
            const tempResponse = response.clone();
            const data = await tempResponse.json().catch(() => ({}));
            console.log(`[AuthProxy] Session data found: ${!!data.session}`);
        }

        // --- PARCHE PARA QUERY-FN (React Query shim) ---
        if (path[0] === 'query-fn' && response.status === 404) {
            console.log(`[AuthProxy] Mocking query-fn for TanStack Query compatibility`);
            return new Response(JSON.stringify(null), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return response;
    } catch (error) {
        console.error(`[AuthProxy] Execution Error:`, error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
