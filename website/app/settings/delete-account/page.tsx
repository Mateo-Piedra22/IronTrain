'use client';

import { AlertTriangle, ArrowLeft, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function DeleteAccountPage() {
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleDelete = async () => {
        if (!confirmed) return;

        setIsDeleting(true);
        setError(null);

        try {
            const res = await fetch('/api/social/profile', {
                method: 'DELETE',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest', // Basic CSRF protection
                }
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
                // Redirect after a short delay
                setTimeout(() => {
                    window.location.href = '/auth/sign-in';
                }, 3000);
            } else {
                setError(data.error || 'Error al eliminar la cuenta');
                setIsDeleting(false);
            }
        } catch (err) {
            setError('Error de conexión con el servidor');
            setIsDeleting(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-[#f5f1e8] flex flex-col items-center justify-center p-6 font-mono text-[#1a1a2e]">
                <div className="w-full max-w-md bg-white border border-[#1a1a2e]/10 p-10 rounded-[2.5rem] shadow-xl text-center space-y-6">
                    <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                        <Trash2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight">Cuenta Eliminada</h1>
                    <p className="text-sm opacity-60 leading-relaxed">
                        Tu perfil de IronSocial y todos los datos asociados han sido eliminados de forma permanente.
                        Redirigiendo a la terminal de inicio...
                    </p>
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#1a1a2e]/20" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f1e8] flex flex-col items-center justify-center p-6 font-mono text-[#1a1a2e]">
            <div className="w-full max-w-md space-y-6">
                <Link
                    href="/auth/bridge"
                    className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                >
                    <ArrowLeft className="w-3 h-3" /> Volver al Bridge
                </Link>

                <div className="bg-white border border-[#1a1a2e]/15 p-10 rounded-[2.5rem] shadow-2xl space-y-8 relative overflow-hidden">
                    {/* Decorative Warning Pattern */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500"></div>

                    <div className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center border border-red-100 mb-2">
                            <ShieldAlert className="w-8 h-8 text-red-600" />
                        </div>
                        <h1 className="text-3xl font-black uppercase italic tracking-tighter">Zona de Peligro</h1>
                        <p className="text-xs opacity-50 leading-relaxed max-w-[280px] mx-auto">
                            Estás a punto de eliminar permanentemente tu identidad en la red IronSocial.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-3">
                            <div className="flex items-center gap-2 text-red-700">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span className="text-[10px] font-black uppercase tracking-widest">¿Qué sucede si borras?</span>
                            </div>
                            <ul className="text-[10px] space-y-2 opacity-70 font-bold uppercase tracking-tight list-disc list-inside">
                                <li>Tu @username quedará libre para otros</li>
                                <li>Perderás tu historial de progreso social</li>
                                <li>Tus conexiones se eliminarán para siempre</li>
                            </ul>
                        </div>

                        <label className="flex items-start gap-4 p-4 bg-[#f5f1e8] rounded-2xl cursor-pointer hover:bg-[#ebe7de] transition-colors group">
                            <input
                                type="checkbox"
                                checked={confirmed}
                                onChange={(e) => setConfirmed(e.target.checked)}
                                className="mt-1 w-5 h-5 rounded border-[#1a1a2e]/20 text-[#1a1a2e] focus:ring-red-500 cursor-pointer"
                            />
                            <span className="text-[11px] font-black uppercase leading-tight opacity-60 group-hover:opacity-100">
                                Entiendo las consecuencias y quiero proceder con la eliminación permanente de mis datos.
                            </span>
                        </label>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-widest text-center rounded-xl border border-red-200">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleDelete}
                        disabled={!confirmed || isDeleting}
                        className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex justify-center items-center gap-3 shadow-lg
                            ${confirmed && !isDeleting
                                ? 'bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-red-200'
                                : 'bg-[#1a1a2e]/5 text-[#1a1a2e]/20 cursor-not-allowed shadow-none'}`}
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
                            </>
                        ) : (
                            'Eliminar Cuenta Permanentemente'
                        )}
                    </button>
                </div>

                <p className="text-[9px] opacity-20 text-center uppercase tracking-widest leading-relaxed">
                    IronHub User Management System v2.0 • Protegiendo la privacidad del atleta
                </p>
            </div>
        </div>
    );
}
