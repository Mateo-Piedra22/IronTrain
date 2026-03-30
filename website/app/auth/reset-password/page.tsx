'use client';

import { ArrowLeft, Check, Loader2, Lock } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { authClient } from '../../../src/lib/auth/client';

export const revalidate = 0;

export default function ResetPasswordPage() {
    const searchParams = useSearchParams();
    const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const invalidToken = !token;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword.length < 8) {
            setError('La nueva contraseña debe tener al menos 8 caracteres');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setLoading(true);
        try {
            const { error: resetError } = await authClient.resetPassword({
                newPassword,
                token,
            });

            if (resetError) {
                setError(resetError.message || 'No se pudo restablecer la contraseña');
                setLoading(false);
                return;
            }

            setDone(true);
            setLoading(false);
        } catch {
            setError('Error inesperado al restablecer contraseña');
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
                        <h1 className="text-2xl font-black uppercase tracking-tight">Nueva Contraseña</h1>
                        <p className="text-xs opacity-60 leading-relaxed">Define una nueva contraseña para tu cuenta.</p>
                    </div>

                    {invalidToken ? (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] font-bold text-red-600 uppercase text-center">
                            Token inválido o ausente. Solicita un nuevo enlace.
                        </div>
                    ) : done ? (
                        <div className="text-center space-y-4 py-4">
                            <div className="mx-auto w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                                <Check className="w-7 h-7 text-green-600" />
                            </div>
                            <p className="text-xs font-bold uppercase tracking-wider opacity-70">
                                Contraseña actualizada correctamente.
                            </p>
                            <Link href="/auth/sign-in" className="inline-block text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">
                                Ir a iniciar sesión
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Nueva contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={8}
                                        className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-[1rem] pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Confirmar contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={8}
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
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar contraseña'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
