import { auth } from '../../../../src/lib/auth/server';

const handlers = auth.handler();

/**
 * Proxy Quirúrgico de Autenticación
 * Soluciona 404s preservando Query Params y limpia el enrutamiento para evitar 508s.
 */
async function proxy(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const url = new URL(request.url);
    const serviceUrl = new URL(process.env.NEON_AUTH_SERVICE_URL!);

    url.protocol = serviceUrl.protocol;
    url.host = serviceUrl.host;

    // 1. Limpiamos la barra final para evitar URLs malformadas como '//path'
    const basePath = serviceUrl.pathname.replace(/\/$/, '');
    url.pathname = `${basePath}/${path.join('/')}`;

    // 2. Transmisión CRÍTICA de parámetros de búsqueda (soluciona 404s)
    url.search = new URL(request.url).search;

    // 3. Pasamos la petición con todos los headers y cuerpo originales
    const proxiedRequest = new Request(url, request);
    const method = request.method as keyof typeof handlers;
    const handler = handlers[method];

    if (typeof handler !== 'function') {
        return new Response('Method not allowed', { status: 405 });
    }

    return (handler as any)(proxiedRequest, { params: Promise.resolve({ path }) });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
