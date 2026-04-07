'use client';

import { AlertTriangle, ArrowRight, Check, Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authClient, directAuthClient } from '../../../src/lib/auth/client';
import { buildAuthBridgeCallbackUrl, buildAuthPageUrl, toAbsoluteAppUrl } from '../../../src/lib/auth/redirects';
import { createProfileAfterSignUp } from '../actions';

function getSocialAuthErrorMessage(error: unknown, provider: string): string {
    const fallback = `No se pudo continuar con ${provider}`;
    if (!error || typeof error !== 'object') return fallback;

    const anyError = error as { message?: string; code?: string; statusText?: string };
    const raw = `${anyError.code || ''} ${anyError.statusText || ''} ${anyError.message || ''}`.toLowerCase();

    if (raw.includes('account_not_linked') || raw.includes('oauth account not linked')) {
        return 'Ya existe una cuenta con este email. Inicia sesión con tu método original y vincula Google desde Seguridad de Cuenta.';
    }

    if (raw.includes('user_already_exists') || raw.includes('already exists')) {
        return 'Ya existe una cuenta con este email. Usa Iniciar Sesión o vincula Google desde tu cuenta actual.';
    }

    return anyError.message || fallback;
}

export function SignUpFlow() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [step, setStep] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const redirectUri = searchParams.get('redirectUri');
    const callbackURL = toAbsoluteAppUrl(buildAuthBridgeCallbackUrl(redirectUri));
    const errorCallbackURL = toAbsoluteAppUrl(buildAuthPageUrl('/auth/sign-up', redirectUri));

    useEffect(() => {
        const authError = String(searchParams.get('error') || '').toLowerCase();
        if (!authError) return;

        if (authError.includes('state_mismatch')) {
            setError('La sesión OAuth expiró o cambió de dominio. Reintenta el registro con Google desde esta pantalla.');
            return;
        }

        if (authError.includes('account_not_linked') || authError.includes('user_already_exists')) {
            setError('Ya existe una cuenta con este email. Inicia sesión y vincula Google desde Seguridad de Cuenta.');
        }
    }, [searchParams]);

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
            const { error: authError } = await directAuthClient.signIn.social({
                provider,
                callbackURL,
                errorCallbackURL,
                newUserCallbackURL: callbackURL,
                requestSignUp: true,
            });

            if (authError) {
                setError(getSocialAuthErrorMessage(authError, provider));
                setLoading(false);
                return;
            }
        } catch {
            setError('Error inesperado en registro social');
            setLoading(false);
        }
    };

    const handleNext = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const normalizedEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setError('Email inválido');
        setEmail(normalizedEmail);
        if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
        if (!name.trim()) return setError('El nombre es requerido');

        setStep(2);
        setDisplayName(name);
    };

    const handleFinish = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const cleanUser = username.trim().toLowerCase();
        if (cleanUser.length < 3 || cleanUser.length > 20) {
            setError('El usuario debe tener entre 3 y 20 caracteres');
            setLoading(false);
            return;
        }

        if (!/^[a-z0-9_]+$/.test(cleanUser)) {
            setError('El usuario solo puede contener letras minúsculas, números y guiones bajos (_)');
            setLoading(false);
            return;
        }

        try {
            // STEP 1: Neon Auth Sign Up
            const { error: authError } = await authClient.signUp.email({
                email,
                password,
                name: name.trim(),
                callbackURL,
            });

            if (authError) {
                setError(authError.message || 'Error al crear cuenta');
                setLoading(false);
                return;
            }

            // STEP 2: Create Profile in our DB
            const profileResult = await createProfileAfterSignUp(cleanUser, displayName || name);
            if (profileResult.error) {
                setError(profileResult.error);
                setLoading(false);
                return;
            }

            // SUCCESS!
            setSuccess(true);
            redirectTimeoutRef.current = setTimeout(() => {
                router.replace(callbackURL);
            }, 1000);
        } catch {
            setError('Error inesperado durante el registro');
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300 py-10">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-black italic tracking-tighter uppercase">¡Cuenta creada!</h2>
                <p className="text-xs opacity-60">Sincronizando identidad con IronTrain...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-center gap-2 mb-4">
                <div className={`h-1 w-12 rounded-full transition-colors ${step >= 1 ? 'bg-[#1a1a2e]' : 'bg-[#1a1a2e]/10'}`} />
                <div className={`h-1 w-12 rounded-full transition-colors ${step >= 2 ? 'bg-[#1a1a2e]' : 'bg-[#1a1a2e]/10'}`} />
            </div>

            {step === 1 ? (
                <form onSubmit={handleNext} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Nombre Completo</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Tu nombre"
                                required
                                className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-[1rem] pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                            />
                        </div>
                    </div>

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
                                minLength={8}
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
                        className="w-full bg-[#1a1a2e] text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex justify-center items-center gap-2 active:scale-95 shadow-sm"
                    >
                        Continuar <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="space-y-2">
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleSocialSignIn('google')}
                            className="w-full bg-white border border-[#1a1a2e]/20 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#f5f1e8] transition-all disabled:opacity-50"
                        >
                            Registrarme con Google
                        </button>
                    </div>

                    <div className="text-center pt-2">
                        <button
                            type="button"
                            onClick={() => router.push('/auth/sign-in')}
                            className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                        >
                            ¿Ya tienes cuenta? Inicia sesión
                        </button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleFinish} className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Nombre de Display</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Cómo te verán otros"
                            required
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-[1rem] px-4 py-4 text-sm font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Username</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold opacity-30">@</span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                placeholder="atleta_iron"
                                required
                                minLength={3}
                                className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-[1rem] pl-10 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                            />
                        </div>
                        <p className="text-[9px] opacity-40 text-center">
                            Solo letras minúsculas, números y guiones bajos (_)
                        </p>
                    </div>

                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <span className="text-[10px] uppercase font-bold text-red-700 tracking-widest leading-relaxed">
                            Esta acción es permanente. No podrás cambiar tu username luego.
                        </span>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] font-bold text-red-600 uppercase text-center">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="bg-[#1a1a2e]/5 border border-[#1a1a2e]/10 px-6 rounded-xl font-bold text-xs uppercase hover:bg-[#1a1a2e]/10 transition-all"
                        >
                            Atrás
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-[#1a1a2e] text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex justify-center items-center gap-2 disabled:opacity-50 active:scale-95 shadow-lg"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Finalizar Registro'}
                        </button>
                    </div>

                </form>
            )}
        </div>
    );
}
