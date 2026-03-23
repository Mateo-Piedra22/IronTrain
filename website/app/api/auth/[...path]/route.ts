import { auth } from '../../../../src/lib/auth/server';

const handlers = auth.handler();

async function proxy(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const url = new URL(request.url);

    // Reescribimos la URL para que coincida con la baseUrl interna configurada en el servidor (server.ts)
    // Esto permite que better-auth reconozca la ruta a pesar de ser un proxy.
    const serviceUrl = new URL(process.env.NEON_AUTH_SERVICE_URL!);
    url.protocol = serviceUrl.protocol;
    url.host = serviceUrl.host;
    url.pathname = `${serviceUrl.pathname}/${path.join('/')}`;

    // Creamos la petición "engañada"
    const proxiedRequest = new Request(url, request);

    // Ejecutamos el handler correspondiente
    const method = request.method as keyof typeof handlers;
    return (handlers[method] as any)(proxiedRequest, { params: Promise.resolve({ path }) });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
