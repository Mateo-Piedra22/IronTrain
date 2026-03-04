import { AuthView } from '@neondatabase/auth/react';

export const dynamicParams = false;

// Neon Auth handles /sign-in, /sign-up, /sign-out
export function generateStaticParams() {
    return [
        { path: 'sign-in' },
        { path: 'sign-up' },
        { path: 'sign-out' },
    ];
}

export default async function AuthPage({
    params
}: {
    params: Promise<{ path: string }>
}) {
    const { path } = await params;

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-6">
            <div className="w-full max-w-sm mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tighter mb-2">Bienvenido a IronHub</h1>
                <p className="text-sm opacity-60">
                    Sincroniza tus rutinas de IronTrain, descarga plantillas y conecta con la comunidad.
                </p>
            </div>
            <AuthView path={path} />
        </div>
    );
}
