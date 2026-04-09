'use client';

import { ArrowRight, Check, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authClient } from '../../../src/lib/auth/client';
import { buildAuthPageUrl, toAbsoluteAppUrl } from '../../../src/lib/auth/redirects';

function getSocialAuthErrorMessage(error: unknown, provider: string): string {
    const fallback = `No se pudo iniciar con ${provider}`;
    if (!error || typeof error !== 'object') return fallback;

    const anyError = error as { message?: string; code?: string; statusText?: string };
    const raw = `${anyError.code || ''} ${anyError.statusText || ''} ${anyError.message || ''}`.toLowerCase();

    if (raw.includes('account_not_linked') || raw.includes('oauth account not linked')) {
        return 'Esta cuenta de Google aún no está vinculada. Inicia con tu método original y luego vincula Google desde Seguridad de Cuenta.';
    }

    if (raw.includes('email_doesn') || raw.includes('email doesn')) {
        return 'El email de Google no coincide con tu cuenta actual. Usa el mismo email o vincula Google desde tu cuenta autenticada.';
    }

    return anyError.message || fallback;
}

function getOAuthCallbackErrorMessage(authError: string): string | null {
    if (!authError) return null;

    if (authError.includes('state_mismatch')) {
        return 'La sesión OAuth expiró o cambió de dominio. Reintenta Google desde esta pantalla.';
    }

    if (authError.includes('account_not_linked')) {
        return 'Esta cuenta de Google aún no está vinculada. Inicia con tu método original y luego vincula Google desde Seguridad de Cuenta.';
    }

    if (authError.includes('oauth_link_requires_custom_domain')) {
        return 'La configuración OAuth requiere dominio personalizado compartido para completar Google en este entorno.';
    }

    if (authError.includes('oauth_link_not_configured')) {
        return 'La integración OAuth no está configurada correctamente en el servidor.';
    }

    if (authError.includes('link_failed_') || authError.includes('oauth_link_failed')) {
        return 'No se pudo completar la autenticación con Google. Intenta nuevamente.';
    }

    return null;
}

async function reportOAuthFailure(payload: {
    provider: 'google';
    flow: 'sign-in';
    source: 'callback_query' | 'client_response';
    error: string;
    redirectUri: string | null;
    callbackURL: string;
    errorCallbackURL: string;
    pagePath: string;
    pageSearch: string;
    userAgent: string;
}) {
    try {
        await fetch('/api/auth/telemetry/oauth-link-failure', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify(payload),
            credentials: 'include',
            keepalive: true,
        });
    } catch {
    }
}

export function SignInFlow() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reportedOAuthErrorRef = useRef<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const redirectUri = searchParams.get('redirectUri');
    const callbackURL = toAbsoluteAppUrl(
        buildAuthPageUrl('/auth/bridge', redirectUri, {
            source: 'website',
            flow: 'sign-in',
            method: 'email',
            status: 'success',
        })
    );
    const socialCallbackURL = toAbsoluteAppUrl(
        buildAuthPageUrl('/auth/bridge', redirectUri, {
            source: 'website',
            flow: 'sign-in',
            method: 'google',
            status: 'success',
        })
    );
    const errorCallbackURL = toAbsoluteAppUrl(buildAuthPageUrl('/auth/sign-in', redirectUri));
    const newUserCallbackURL = toAbsoluteAppUrl(buildAuthPageUrl('/auth/sign-up', redirectUri));

    useEffect(() => {
        const authError = String(searchParams.get('error') || '').toLowerCase();
        if (!authError) return;

        if (reportedOAuthErrorRef.current !== authError) {
            reportedOAuthErrorRef.current = authError;
            void reportOAuthFailure({
                provider: 'google',
                flow: 'sign-in',
                source: 'callback_query',
                error: authError,
                redirectUri,
                callbackURL: socialCallbackURL,
                errorCallbackURL,
                pagePath: typeof window !== 'undefined' ? window.location.pathname : '/auth/sign-in',
                pageSearch: typeof window !== 'undefined' ? window.location.search : '',
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            });
        }

        const mappedMessage = getOAuthCallbackErrorMessage(authError);
        if (mappedMessage) {
            setError(mappedMessage);
        }
    }, [searchParams, redirectUri, socialCallbackURL, errorCallbackURL]);

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
                callbackURL: socialCallbackURL,
                errorCallbackURL,
                newUserCallbackURL,
            });

            if (authError) {
                const raw = `${(authError as any)?.code || ''} ${(authError as any)?.statusText || ''} ${(authError as any)?.message || ''}`.toLowerCase().trim() || 'oauth_client_error';
                void reportOAuthFailure({
                    provider: 'google',
                    flow: 'sign-in',
                    source: 'client_response',
                    error: raw.slice(0, 128),
                    redirectUri,
                    callbackURL: socialCallbackURL,
                    errorCallbackURL,
                    pagePath: typeof window !== 'undefined' ? window.location.pathname : '/auth/sign-in',
                    pageSearch: typeof window !== 'undefined' ? window.location.search : '',
                    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                });
                setError(getSocialAuthErrorMessage(authError, provider));
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
                callbackURL,
            });

            if (authError) {
                setError(authError.message || 'Error al iniciar sesión');
                setLoading(false);
                return;
            }

            setSuccess(true);
            redirectTimeoutRef.current = setTimeout(() => {
                router.replace(callbackURL);
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
