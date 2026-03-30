'use client';

import { ArrowLeft, Check, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { authClient } from '../../../src/lib/auth/client';

export const revalidate = 0;

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const redirectTo = `${window.location.origin}/auth/reset-password`;
            const { error: resetError } = await authClient.requestPasswordReset({
                email,
                redirectTo,
            });

            if (resetError) {
                setError(resetError.message || 'No se pudo enviar el correo de recuperación');
                setLoading(false);
                return;
            }

            setSent(true);
            setLoading(false);
        } catch {
            setError('Error inesperado al solicitar recuperación');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f1e8] flex flex-col items-center justify-center p-6 font-mono text-[#1a1a2e]">
            <div className="w-full max-w-sm space-y-4">
                <Link href="/auth/sign-in" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">
                    <ArrowLeft className="w-3 h-3" /> Volver
                </Link>

                <div className="bg-white border border-[#1a1a2e]/20 p-8 rounded-[2rem] shadow-sm space-y-6">
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-black uppercase tracking-tight">Recuperar Contraseña</h1>
                        <p className="text-xs opacity-60 leading-relaxed">Te enviaremos un enlace para restablecer tu acceso.</p>
                    </div>

                    {sent ? (
                        <div className="text-center space-y-4 py-4">
                            <div className="mx-auto w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                                <Check className="w-7 h-7 text-green-600" />
                            </div>
                            <p className="text-xs font-bold uppercase tracking-wider opacity-70">
                                Si el correo existe, enviamos instrucciones de recuperación.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
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

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] font-bold text-red-600 uppercase text-center">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#1a1a2e] text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar enlace'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
