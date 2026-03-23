import { auth } from '../../../../src/lib/auth/server';

const handlers = auth.handler();

/**
 * Proxy de Autenticación con Reescritura de URL
 * 1. Recibe peticiones desde el dominio público (irontrain.motiona.xyz/api/auth/*)
 * 2. Reescribe la URL para que coincida con la red interna (xxx.neonauth.tech/neondb/auth/*)
 * 3. Pasa la petición al handler interno de Neon Auth.
 * 
 * Esto soluciona:
 * - Error 404: El handler reconoce la ruta porque la URL reescrita coincide con su baseUrl interna.
 * - Error 508: El handler hace fetch a la URL reescrita (Neon externa) en lugar de a sí mismo.
 */
async function proxy(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const url = new URL(request.url);

    const serviceUrl = new URL(process.env.NEON_AUTH_SERVICE_URL!);
    url.protocol = serviceUrl.protocol;
    url.host = serviceUrl.host;
    url.pathname = `${serviceUrl.pathname}/${path.join('/')}`;

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
