import { AuthView } from '@neondatabase/auth/react';
import { SignInFlow } from '../../../auth/components/SignInFlow';
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
    const isSignIn = path === 'sign-in';

    return (
        <div className="min-h-screen bg-[#f5f1e8] flex flex-col items-center justify-center p-6 font-mono text-[#1a1a2e]">
            <div className="w-full max-w-sm">
                <div className="bg-white border border-[#1a1a2e]/20 p-8 rounded-[2rem] shadow-sm space-y-6">
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-black uppercase tracking-tight italic">
                            {isSignUp ? 'Crear Cuenta' : isSignIn ? 'Iniciar Sesión' : 'Bienvenido'}
                        </h1>
                        <p className="text-xs opacity-60 leading-relaxed">
                            {isSignUp
                                ? 'Configura tu identidad en IronTrain.'
                                : isSignIn
                                    ? 'Vuelve a tu zona de entrenamiento.'
                                    : 'Sincroniza tus rutinas y conecta con la comunidad.'
                            }
                        </p>
                    </div>

                    {isSignUp ? (
                        <SignUpFlow />
                    ) : isSignIn ? (
                        <SignInFlow />
                    ) : (
                        <AuthView path={path} />
                    )}
                </div>
            </div>
        </div>
    );
}
