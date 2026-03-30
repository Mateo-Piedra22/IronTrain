'use client';

import { ArrowRight, Check, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authClient } from '../../../src/lib/auth/client';

export function SignInFlow() {
    const router = useRouter();
    const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        return () => {
            if (redirectTimeoutRef.current) {
                clearTimeout(redirectTimeoutRef.current);
            }
        };
    }, []);

    const handleSocialSignIn = async (provider: 'google') => {
        setError(null);
        setLoading(true);
        try {
            const { error: authError } = await authClient.signIn.social({
                provider,
                callbackURL: '/auth/bridge',
            });

            if (authError) {
                setError(authError.message || `No se pudo iniciar con ${provider}`);
                setLoading(false);
                return;
            }
        } catch {
            setError('Error inesperado en login social');
            setLoading(false);
        }
    };

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const normalizedEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setError('Ingresa un email válido');
            setLoading(false);
            return;
        }

        try {
            const { error: authError } = await authClient.signIn.email({
                email: normalizedEmail,
                password,
                callbackURL: '/auth/bridge'
            });

            if (authError) {
                setError(authError.message || 'Error al iniciar sesión');
                setLoading(false);
                return;
            }

            setSuccess(true);
            redirectTimeoutRef.current = setTimeout(() => {
                router.replace('/auth/bridge');
            }, 1000);
        } catch {
            setError('Error inesperado');
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300 py-10">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-black italic tracking-tighter uppercase">¡Bienvenido!</h2>
                <p className="text-xs opacity-60">Sincronizando identidad...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Email</label>
                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@ejemplo.com"
                        required
                        className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-[1rem] pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Contraseña</label>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-[1rem] pl-12 pr-12 py-4 text-sm font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition-opacity"
                    >
                        {showPassword ? <EyeOff className="w-4 h-4 opacity-30" /> : <Eye className="w-4 h-4 opacity-30" />}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] font-bold text-red-600 uppercase text-center">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1a1a2e] text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex justify-center items-center gap-2 active:scale-95 shadow-lg disabled:opacity-50"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Entrar <ArrowRight className="w-4 h-4" /></>}
            </button>

            <div className="space-y-2">
                <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSocialSignIn('google')}
                    className="w-full bg-white border border-[#1a1a2e]/20 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#f5f1e8] transition-all disabled:opacity-50"
                >
                    Continuar con Google
                </button>
            </div>

            <div className="text-center">
                <button
                    type="button"
                    onClick={() => router.push('/auth/forgot-password')}
                    className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                >
                    ¿Olvidaste tu contraseña?
                </button>
            </div>

            <div className="text-center pt-2">
                <button
                    type="button"
                    onClick={() => router.push('/auth/sign-up')}
                    className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                >
                    ¿No tienes cuenta? Regístrate
                </button>
            </div>
        </form>
    );
}
