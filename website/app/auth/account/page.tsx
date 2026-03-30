'use client';

import { AlertTriangle, ArrowLeft, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { authClient } from '../../../src/lib/auth/client';

export const revalidate = 0;

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

export default function AccountSecurityPage() {
    const router = useRouter();
    const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [verifyEmail, setVerifyEmail] = useState('');

    const [newEmail, setNewEmail] = useState('');

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const [deletePassword, setDeletePassword] = useState('');

    useEffect(() => {
        return () => {
            if (redirectTimeoutRef.current) {
                clearTimeout(redirectTimeoutRef.current);
            }
        };
    }, []);

    const resetMessages = () => {
        setError(null);
        setSuccess(null);
    };

    const callbackURL = useMemo(() => {
        if (typeof window === 'undefined') return '/auth/bridge';
        return `${window.location.origin}/auth/bridge`;
    }, []);

    const handleSendVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        resetMessages();
        setBusy('verify');

        try {
            const { error: apiError } = await authClient.sendVerificationEmail({
                email: verifyEmail,
                callbackURL,
            });
            if (apiError) {
                setError(apiError.message || 'No se pudo enviar el correo de verificación');
                setBusy(null);
                return;
            }
            setSuccess('Correo de verificación enviado');
        } catch {
            setError('Error inesperado al enviar verificación');
        } finally {
            setBusy(null);
        }
    };

    const handleChangeEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        resetMessages();
        setBusy('email');

        try {
            const { error: apiError } = await authClient.changeEmail({
                newEmail,
                callbackURL,
            });
            if (apiError) {
                setError(apiError.message || 'No se pudo solicitar cambio de email');
                setBusy(null);
                return;
            }
            setSuccess('Cambio de email solicitado. Revisa tu correo para confirmar.');
            setNewEmail('');
        } catch {
            setError('Error inesperado al cambiar email');
        } finally {
            setBusy(null);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        resetMessages();
        setBusy('password');

        try {
            const { error: apiError } = await authClient.changePassword({
                currentPassword,
                newPassword,
                revokeOtherSessions: true,
            });
            if (apiError) {
                setError(apiError.message || 'No se pudo cambiar la contraseña');
                setBusy(null);
                return;
            }
            setSuccess('Contraseña actualizada correctamente');
            setCurrentPassword('');
            setNewPassword('');
        } catch {
            setError('Error inesperado al cambiar contraseña');
        } finally {
            setBusy(null);
        }
    };

    const handleDeleteAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        resetMessages();

        const confirmed = window.confirm('Esta acción eliminará tu cuenta y datos de forma irreversible. ¿Deseas continuar?');
        if (!confirmed) {
            return;
        }

        setBusy('delete');

        const trimmedDeletePassword = deletePassword.trim();
        if (!trimmedDeletePassword) {
            setError('Debes confirmar tu contraseña para eliminar la cuenta');
            setBusy(null);
            return;
        }

        try {
            const wipe = await fetch('/api/sync/wipe', {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!wipe.ok) {
                const wipeData = await wipe.json().catch(() => ({}));
                throw new Error(wipeData.error || 'No se pudo limpiar los datos de aplicación');
            }

            const { error: deleteError } = await authClient.deleteUser({
                password: trimmedDeletePassword,
            });

            if (deleteError) {
                setError(deleteError.message || 'No se pudo eliminar la cuenta');
                setBusy(null);
                return;
            }

            setSuccess('Cuenta eliminada. Redirigiendo...');
            redirectTimeoutRef.current = setTimeout(() => {
                router.replace('/auth/sign-in');
            }, 1200);
        } catch (error: unknown) {
            setError(getErrorMessage(error, 'Error inesperado al eliminar cuenta'));
        } finally {
            setBusy(null);
        }
    };

    const handleExportData = async () => {
        resetMessages();
        setBusy('export');
        try {
            const response = await fetch('/api/privacy/export', {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'No se pudo exportar la información');
            }

            const blob = await response.blob();
            const disposition = response.headers.get('content-disposition') || '';
            const fileNameMatch = disposition.match(/filename="?([^";]+)"?/i);
            const fileName = fileNameMatch?.[1] || 'irontrain_privacy_export.json';

            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);

            setSuccess('Exportación lista. Archivo descargado correctamente.');
        } catch (error: unknown) {
            setError(getErrorMessage(error, 'Error inesperado al exportar datos'));
        } finally {
            setBusy(null);
        }
    };

    const handleDeactivateAccount = async () => {
        resetMessages();

        const confirmed = window.confirm('Tu cuenta se desactivará y se cerrará tu sesión. ¿Deseas continuar?');
        if (!confirmed) {
            return;
        }

        setBusy('deactivate');
        try {
            const response = await fetch('/api/privacy/deactivate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'No se pudo desactivar la cuenta');
            }

            await authClient.signOut();
            setSuccess('Cuenta desactivada. Cerrando sesión...');
            redirectTimeoutRef.current = setTimeout(() => {
                router.replace('/auth/sign-in');
            }, 1200);
        } catch (error: unknown) {
            setError(getErrorMessage(error, 'Error inesperado al desactivar cuenta'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f1e8] flex flex-col items-center justify-center p-6 font-mono text-[#1a1a2e]">
            <div className="w-full max-w-lg space-y-4">
                <Link href="/auth/bridge" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">
                    <ArrowLeft className="w-3 h-3" /> Volver
                </Link>

                <div className="bg-white border border-[#1a1a2e]/20 p-8 rounded-[2rem] shadow-sm space-y-6">
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-black uppercase tracking-tight">Seguridad de Cuenta</h1>
                        <p className="text-xs opacity-60 leading-relaxed">Gestiona verificación, email, contraseña y eliminación total.</p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] font-bold text-red-600 uppercase text-center">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-[10px] font-bold text-green-700 uppercase text-center flex items-center justify-center gap-2">
                            <Check className="w-4 h-4" /> {success}
                        </div>
                    )}

                    <form onSubmit={handleSendVerification} className="space-y-2 border border-[#1a1a2e]/10 rounded-xl p-4">
                        <h2 className="text-[11px] font-black uppercase tracking-widest">Verificar Email</h2>
                        <input
                            type="email"
                            value={verifyEmail}
                            onChange={(e) => setVerifyEmail(e.target.value)}
                            required
                            placeholder="email@ejemplo.com"
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20"
                        />
                        <button type="submit" disabled={busy !== null} className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex justify-center items-center gap-2">
                            {busy === 'verify' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar verificación'}
                        </button>
                    </form>

                    <form onSubmit={handleChangeEmail} className="space-y-2 border border-[#1a1a2e]/10 rounded-xl p-4">
                        <h2 className="text-[11px] font-black uppercase tracking-widest">Cambiar Email</h2>
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            required
                            placeholder="nuevo@email.com"
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20"
                        />
                        <button type="submit" disabled={busy !== null} className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex justify-center items-center gap-2">
                            {busy === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Solicitar cambio'}
                        </button>
                    </form>

                    <form onSubmit={handleChangePassword} className="space-y-2 border border-[#1a1a2e]/10 rounded-xl p-4">
                        <h2 className="text-[11px] font-black uppercase tracking-widest">Cambiar Contraseña</h2>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                            minLength={8}
                            placeholder="Contraseña actual"
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20"
                        />
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                            placeholder="Nueva contraseña"
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20"
                        />
                        <button type="submit" disabled={busy !== null} className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex justify-center items-center gap-2">
                            {busy === 'password' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualizar contraseña'}
                        </button>
                    </form>

                    <form onSubmit={handleDeleteAccount} className="space-y-2 border border-red-200 bg-red-50 rounded-xl p-4">
                        <h2 className="text-[11px] font-black uppercase tracking-widest text-red-700 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Eliminar Cuenta Total
                        </h2>
                        <p className="text-[10px] font-bold uppercase opacity-60">
                            Borra datos de app y elimina la cuenta auth de forma irreversible.
                        </p>
                        <input
                            type="password"
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            required
                            placeholder="Contraseña actual"
                            className="w-full bg-white border border-red-200 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-red-300"
                        />
                        <button type="submit" disabled={busy !== null} className="w-full bg-red-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex justify-center items-center gap-2 hover:bg-red-700 transition-colors">
                            {busy === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar cuenta'}
                        </button>
                    </form>

                    <div className="space-y-2 border border-[#1a1a2e]/10 rounded-xl p-4">
                        <h2 className="text-[11px] font-black uppercase tracking-widest">Privacidad y Portabilidad</h2>
                        <button
                            type="button"
                            onClick={handleExportData}
                            disabled={busy !== null}
                            className="w-full bg-white border border-[#1a1a2e]/20 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-[#f5f1e8] transition-colors"
                        >
                            {busy === 'export' ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Exportando</span> : 'Exportar mis datos'}
                        </button>
                        <button
                            type="button"
                            onClick={handleDeactivateAccount}
                            disabled={busy !== null}
                            className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-black transition-colors"
                        >
                            {busy === 'deactivate' ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Desactivando</span> : 'Desactivar cuenta'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
