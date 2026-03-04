import { AuthView } from '@neondatabase/auth/react';
import { SignUpFlow } from '../../../auth/components/SignUpFlow';

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
    params: Promise<{ path: string }>;
}) {
    const { path } = await params;
    const isSignUp = path === 'sign-up';

    return (
        <div className="min-h-screen bg-[#f5f1e8] flex flex-col items-center justify-center p-6 font-mono text-[#1a1a2e]">
            <div className="w-full max-w-sm">
                <div className="bg-white border border-[#1a1a2e]/20 p-8 rounded-[2rem] shadow-sm space-y-6">
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-black uppercase tracking-tight">
                            {isSignUp ? 'Crear Cuenta' : 'Bienvenido a IronTrain'}
                        </h1>
                        <p className="text-xs opacity-60 leading-relaxed">
                            {isSignUp
                                ? 'Sigue los pasos para configurar tu identidad en la plataforma.'
                                : 'Sincroniza tus rutinas de IronTrain, descarga plantillas y conecta con la comunidad.'
                            }
                        </p>
                    </div>

                    {isSignUp ? (
                        <SignUpFlow />
                    ) : (
                        <AuthView path={path} />
                    )}
                </div>
            </div>
        </div>
    );
}
