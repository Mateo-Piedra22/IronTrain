'use client';

import { AlertTriangle, ArrowLeft, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { authClient } from '../../../src/lib/auth/client';
import { buildAuthBridgeCallbackUrl, buildAuthPageUrl, buildSocialLinkCallbackUrl, toAbsoluteAppUrl } from '../../../src/lib/auth/redirects';
import { performSignOut } from '../../../src/lib/auth/signout';

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

async function reportOAuthLinkFailure(payload: {
    provider: 'google';
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

async function callAuthProxy(paths: string[], payload?: Record<string, unknown>) {
    let lastError: string | null = null;

    for (const path of paths) {
        try {
            const response = await fetch(path, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify(payload ?? {}),
                credentials: 'include',
            });

            if (response.ok) {
                return { ok: true as const, path };
            }

            const data = await response.json().catch(() => ({}));
            const message = data?.error || data?.message || `Request failed (${response.status})`;
            lastError = String(message);
        } catch (error) {
            lastError = getErrorMessage(error, 'Network error');
        }
    }

    return { ok: false as const, error: lastError || 'No se pudo completar la operación' };
}

export default function AccountSecurityPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = authClient.useSession();
    const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reportedOAuthErrorRef = useRef<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [verifyEmail, setVerifyEmail] = useState('');

    const [newEmail, setNewEmail] = useState('');

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const [deletePassword, setDeletePassword] = useState('');
    const [profileDisplayName, setProfileDisplayName] = useState('');
    const [profileUsername, setProfileUsername] = useState('');
    const [profilePublic, setProfilePublic] = useState(true);
    const [authName, setAuthName] = useState('');
    const [accountEmail, setAccountEmail] = useState('');
    const [accountStatus, setAccountStatus] = useState<{ googleLinked: boolean; sessions: number | null }>({
        googleLinked: false,
        sessions: null,
    });

    useEffect(() => {
        return () => {
            if (redirectTimeoutRef.current) {
                clearTimeout(redirectTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadAuthStatus = async () => {
            const authAny = authClient as any;

            try {
                const listAccounts = authAny?.listAccounts;
                if (typeof listAccounts === 'function') {
                    const result = await listAccounts();
                    const accounts = Array.isArray(result?.data) ? result.data : [];
                    if (!cancelled) {
                        setAccountStatus((prev) => ({
                            ...prev,
                            googleLinked: accounts.some((acc: any) => String(acc?.providerId || '').toLowerCase() === 'google'),
                        }));
                    }
                }
            } catch {
            }

            try {
                const listSessions = authAny?.listSessions;
                if (typeof listSessions === 'function') {
                    const result = await listSessions();
                    const sessions = Array.isArray(result?.data) ? result.data : [];
                    if (!cancelled) {
                        setAccountStatus((prev) => ({ ...prev, sessions: sessions.length }));
                    }
                }
            } catch {
            }
        };

        loadAuthStatus();

        return () => {
            cancelled = true;
        };
    }, []);

    /**
     * Re-fetches the linked accounts status.
     * Called after link/unlink operations to verify the result.
     */
    const refreshAccountStatus = async () => {
        try {
            const authAny = authClient as any;
            const listAccounts = authAny?.listAccounts;
            if (typeof listAccounts === 'function') {
                const result = await listAccounts();
                const accounts = Array.isArray(result?.data) ? result.data : [];
                setAccountStatus((prev) => ({
                    ...prev,
                    googleLinked: accounts.some((acc: any) => String(acc?.providerId || '').toLowerCase() === 'google'),
                }));
            }
        } catch {
        }
    };

    useEffect(() => {
        if (session?.user?.name) {
            setAuthName(String(session.user.name));
        }
        if (session?.user?.email) {
            setAccountEmail(String(session.user.email));
            if (!verifyEmail) {
                setVerifyEmail(String(session.user.email));
            }
        }
    }, [session, verifyEmail]);

    useEffect(() => {
        let cancelled = false;

        const loadProfile = async () => {
            try {
                const response = await fetch('/api/social/profile', {
                    method: 'GET',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    cache: 'no-store',
                });

                if (!response.ok) return;
                const payload = await response.json().catch(() => null);
                const profile = payload?.profile;
                if (!profile || cancelled) return;

                setProfileDisplayName(String(profile.displayName || ''));
                setProfileUsername(String(profile.username || ''));
                setProfilePublic(Boolean(profile.isPublic ?? true));
            } catch {
            }
        };

        loadProfile();

        return () => {
            cancelled = true;
        };
    }, []);

    const resetMessages = () => {
        setError(null);
        setSuccess(null);
    };

    const callbackURL = useMemo(() => toAbsoluteAppUrl('/auth/bridge'), []);

    const socialCallbackURL = useMemo(
        () => toAbsoluteAppUrl(buildAuthBridgeCallbackUrl(searchParams.get('redirectUri'))),
        [searchParams]
    );

    const socialLinkCallbackURL = useMemo(
        () => toAbsoluteAppUrl(buildSocialLinkCallbackUrl('google', searchParams.get('redirectUri'))),
        [searchParams]
    );

    const socialLinkErrorCallbackURL = useMemo(
        () => toAbsoluteAppUrl(buildAuthPageUrl('/auth/account', searchParams.get('redirectUri'), { error: 'oauth_link_failed' })),
        [searchParams]
    );

    useEffect(() => {
        const authError = String(searchParams.get('error') || '').toLowerCase();
        if (!authError) return;

        const isLinkCallbackFailure = authError.includes('state_mismatch') || authError.includes('oauth_link_failed');
        if (isLinkCallbackFailure && reportedOAuthErrorRef.current !== authError) {
            reportedOAuthErrorRef.current = authError;

            void reportOAuthLinkFailure({
                provider: 'google',
                error: authError,
                redirectUri: searchParams.get('redirectUri'),
                callbackURL: socialLinkCallbackURL,
                errorCallbackURL: socialLinkErrorCallbackURL,
                pagePath: typeof window !== 'undefined' ? window.location.pathname : '/auth/account',
                pageSearch: typeof window !== 'undefined' ? window.location.search : '',
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            });
        }

        if (authError.includes('state_mismatch')) {
            setError('La sesión OAuth de vinculación expiró o cambió de dominio. Reintenta vincular Google desde esta pantalla.');
            return;
        }

        if (authError.includes('oauth_link_failed')) {
            setError('No se pudo completar la vinculación con Google. Intenta nuevamente.');
        }
    }, [searchParams, socialLinkCallbackURL, socialLinkErrorCallbackURL]);

    useEffect(() => {
        if (searchParams.get('linked') === 'google') {
            // After returning from Google OAuth, verify the link actually happened
            // then show success message
            const verifyAndConfirm = async () => {
                await refreshAccountStatus();
                setSuccess('Google vinculado correctamente. Ya puedes iniciar sesión con ambos métodos.');
                setError(null);
                setBusy(null);
            };
            verifyAndConfirm();

            if (searchParams.get('redirectUri')) {
                const timeout = window.setTimeout(() => {
                    router.replace(socialCallbackURL);
                }, 1500);
                return () => window.clearTimeout(timeout);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router, searchParams, socialCallbackURL]);

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

    const handleUpdateProfileIdentity = async (e: React.FormEvent) => {
        e.preventDefault();
        resetMessages();
        setBusy('profile-identity');

        const normalizedDisplayName = profileDisplayName.trim();
        const normalizedUsername = profileUsername.trim().toLowerCase();

        if (normalizedDisplayName.length < 1 || normalizedDisplayName.length > 50) {
            setError('El nombre visible debe tener entre 1 y 50 caracteres');
            setBusy(null);
            return;
        }

        if (!/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
            setError('El username debe tener entre 3 y 20 caracteres y usar solo minúsculas, números y _');
            setBusy(null);
            return;
        }

        try {
            const response = await fetch('/api/social/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    displayName: normalizedDisplayName,
                    username: normalizedUsername,
                    isPublic: profilePublic,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'No se pudo actualizar el perfil');
            }

            setProfileDisplayName(normalizedDisplayName);
            setProfileUsername(normalizedUsername);
            setSuccess('Perfil actualizado correctamente');
        } catch (updateError: unknown) {
            setError(getErrorMessage(updateError, 'Error inesperado al actualizar perfil'));
        } finally {
            setBusy(null);
        }
    };

    const handleUpdateAuthName = async (e: React.FormEvent) => {
        e.preventDefault();
        resetMessages();
        setBusy('auth-name');

        const normalizedName = authName.trim();
        if (normalizedName.length < 1 || normalizedName.length > 80) {
            setError('El nombre de cuenta debe tener entre 1 y 80 caracteres');
            setBusy(null);
            return;
        }

        try {
            const { error: apiError } = await authClient.updateUser({ name: normalizedName });
            if (apiError) {
                setError(apiError.message || 'No se pudo actualizar el nombre de cuenta');
                setBusy(null);
                return;
            }

            await authClient.getSession().catch(() => null);
            setSuccess('Nombre de cuenta actualizado');
        } catch {
            setError('Error inesperado al actualizar nombre de cuenta');
        } finally {
            setBusy(null);
        }
    };

    const handleLinkGoogle = async () => {
        resetMessages();

        // Guard: Prevent linking if already linked
        if (accountStatus.googleLinked) {
            setError('Google ya está vinculado a esta cuenta.');
            return;
        }

        // Guard: Verify session exists before initiating OAuth flow
        if (!session?.user?.id) {
            setError('No hay sesión activa. Cierra sesión e ingresa nuevamente antes de vincular.');
            return;
        }

        setBusy('link-google');

        try {
            // Use the same-origin authClient (goes through /api/auth proxy) to call linkSocial.
            // This is the official pattern used by Better Auth UI.
            // The proxy handles session authentication via cookies (same-origin, no CORS issues).
            // The OAuth state cookie is set on the APP domain as a first-party cookie,
            // ensuring no third-party cookie blocking occurs.
            const { error: apiError } = await authClient.linkSocial({
                provider: 'google',
                callbackURL: socialLinkCallbackURL,
                errorCallbackURL: socialLinkErrorCallbackURL,
            });

            // If linkSocial succeeds, the SDK's redirect plugin navigates the browser
            // to Google. The user returns via the neon_auth_session_verifier flow.
            // We only reach here if there's an error before the redirect.

            if (apiError) {
                const raw = `${apiError.message || ''}`.toLowerCase();
                if (raw.includes('unauthorized') || raw.includes('401') || raw.includes('session') || raw.includes('unauthenticated')) {
                    setError('Tu sesión no es válida para vincular Google. Cierra sesión, vuelve a entrar e intenta nuevamente.');
                } else if (raw.includes('already_linked') || raw.includes('already linked')) {
                    setError('Esta cuenta de Google ya está vinculada a otro usuario.');
                    // Refresh the linked status in case it was already linked to THIS user
                    refreshAccountStatus();
                } else if (raw.includes('email_doesn') || raw.includes('email doesn')) {
                    setError('El email de Google no coincide con tu cuenta actual. Usa la cuenta Google con el mismo email para mantener la seguridad.');
                } else {
                    setError(apiError.message || 'No se pudo vincular Google en este momento');
                }
                setBusy(null);
                return;
            }
        } catch (err) {
            console.error('[auth/account] linkSocial error:', err);
            setError('Error inesperado al vincular Google. Intenta nuevamente.');
            setBusy(null);
        }
    };

    const handleUnlinkGoogle = async () => {
        resetMessages();

        if (!accountStatus.googleLinked) {
            setError('Google ya está desvinculado para esta cuenta.');
            return;
        }

        const confirmed = window.confirm('¿Seguro que deseas desvincular Google de esta cuenta?');
        if (!confirmed) return;

        setBusy('unlink-google');

        try {
            const authAny = authClient as any;
            const unlink = authAny?.unlinkAccount;
            let done = false;

            if (typeof unlink === 'function') {
                const { error: apiError } = await unlink({ providerId: 'google' });
                if (!apiError) {
                    done = true;
                } else {
                    if (process.env.NODE_ENV === 'production') {
                        console.info('[auth/account] unlinkAccount primary failed', {
                            providerId: 'google',
                            code: String((apiError as any)?.code || ''),
                            message: String((apiError as any)?.message || ''),
                        });
                    }

                    const code = String((apiError as any)?.code || '').toLowerCase();
                    if (code.includes('cannot_unlink_last_account')) {
                        setError('No se puede desvincular Google porque es tu último método de acceso. Agrega otro método primero.');
                        setBusy(null);
                        return;
                    }
                }
            }

            if (!done) {
                const fallback = await callAuthProxy([
                    '/api/auth/unlinkAccount',
                    '/api/auth/account/unlink',
                ], {
                    providerId: 'google',
                });

                if (!fallback.ok) {
                    if (process.env.NODE_ENV === 'production') {
                        console.info('[auth/account] unlinkAccount fallback failed', {
                            providerId: 'google',
                            attemptedPaths: [
                                '/api/auth/unlinkAccount',
                                '/api/auth/account/unlink',
                            ],
                            error: String(fallback.error || ''),
                        });
                    }

                    const raw = String(fallback.error || '').toLowerCase();
                    if (raw.includes('cannot_unlink_last_account') || raw.includes('last account')) {
                        setError('No se puede desvincular Google porque es tu último método de acceso. Agrega otro método primero.');
                    } else {
                        setError(fallback.error || 'No se pudo desvincular Google');
                    }
                    setBusy(null);
                    return;
                }
            }

            setAccountStatus((prev) => ({ ...prev, googleLinked: false }));
            setSuccess('Google desvinculado correctamente');
        } catch {
            setError('Error inesperado al desvincular Google');
        } finally {
            setBusy(null);
        }
    };

    const handleRevokeOtherSessions = async () => {
        resetMessages();
        setBusy('revoke-sessions');

        try {
            const authAny = authClient as any;
            const revokeOthers = authAny?.revokeOtherSessions;
            let done = false;

            if (typeof revokeOthers === 'function') {
                const { error: apiError } = await revokeOthers();
                if (!apiError) {
                    done = true;
                }
            }

            if (!done) {
                const fallback = await callAuthProxy([
                    '/api/auth/revokeOtherSessions',
                    '/api/auth/multi-session/revoke-other-sessions',
                ]);
                if (!fallback.ok) {
                    setError(fallback.error || 'No se pudieron revocar las otras sesiones');
                    setBusy(null);
                    return;
                }
            }

            setAccountStatus((prev) => ({
                ...prev,
                sessions: prev.sessions !== null ? 1 : prev.sessions,
            }));
            setSuccess('Se cerraron todas las demás sesiones activas');
        } catch {
            setError('Error inesperado al revocar sesiones');
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

            await performSignOut(router);
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

                    <form onSubmit={handleUpdateProfileIdentity} className="space-y-2 border border-[#1a1a2e]/10 rounded-xl p-4">
                        <h2 className="text-[11px] font-black uppercase tracking-widest">Perfil Público (IronTrain)</h2>
                        <input
                            type="text"
                            value={profileDisplayName}
                            onChange={(e) => setProfileDisplayName(e.target.value)}
                            required
                            minLength={1}
                            maxLength={50}
                            placeholder="Nombre visible"
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20"
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black opacity-40">@</span>
                            <input
                                type="text"
                                value={profileUsername}
                                onChange={(e) => setProfileUsername(e.target.value.toLowerCase())}
                                required
                                minLength={3}
                                maxLength={20}
                                pattern="[a-z0-9_]+"
                                title="Solo minúsculas, números y guiones bajos"
                                placeholder="username"
                                className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl pl-8 pr-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20"
                            />
                        </div>
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-70">
                            <input
                                type="checkbox"
                                checked={profilePublic}
                                onChange={(e) => setProfilePublic(e.target.checked)}
                                className="accent-[#1a1a2e]"
                            />
                            Perfil público
                        </label>
                        <button type="submit" disabled={busy !== null} className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex justify-center items-center gap-2">
                            {busy === 'profile-identity' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar perfil'}
                        </button>
                    </form>

                    <form onSubmit={handleUpdateAuthName} className="space-y-2 border border-[#1a1a2e]/10 rounded-xl p-4">
                        <h2 className="text-[11px] font-black uppercase tracking-widest">Cuenta Auth</h2>
                        <input
                            type="text"
                            value={authName}
                            onChange={(e) => setAuthName(e.target.value)}
                            required
                            minLength={1}
                            maxLength={80}
                            placeholder="Nombre de cuenta"
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20"
                        />
                        <input
                            type="email"
                            value={accountEmail}
                            readOnly
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold opacity-70"
                        />
                        <button type="submit" disabled={busy !== null} className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex justify-center items-center gap-2">
                            {busy === 'auth-name' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualizar nombre de cuenta'}
                        </button>
                    </form>

                    <div className="space-y-3 border border-[#1a1a2e]/10 rounded-xl p-4">
                        <h2 className="text-[11px] font-black uppercase tracking-widest">Login Social</h2>
                        <div className={`text-[10px] font-bold uppercase flex items-center gap-2 ${accountStatus.googleLinked ? 'text-green-700' : 'opacity-50'}`}>
                            <span className={`inline-block w-2 h-2 rounded-full ${accountStatus.googleLinked ? 'bg-green-500' : 'bg-gray-300'}`} />
                            Google: {accountStatus.googleLinked ? 'VINCULADO' : 'NO VINCULADO'}
                        </div>

                        {!accountStatus.googleLinked && (
                            <>
                                <p className="text-[10px] font-bold uppercase opacity-60">
                                    Vincula Google para entrar con el mismo usuario sin crear cuentas duplicadas.
                                </p>
                                <p className="text-[10px] font-bold uppercase opacity-50">
                                    Recomendado: usa la misma dirección de email de tu cuenta actual.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleLinkGoogle}
                                    disabled={busy !== null || accountStatus.googleLinked}
                                    className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-black transition-colors flex justify-center items-center gap-2"
                                >
                                    {busy === 'link-google' ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirigiendo a Google...</> : 'Vincular Google'}
                                </button>
                            </>
                        )}

                        {accountStatus.googleLinked && (
                            <button
                                type="button"
                                onClick={handleUnlinkGoogle}
                                disabled={busy !== null}
                                className="w-full bg-white border border-[#1a1a2e]/20 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-[#f5f1e8] transition-colors flex justify-center items-center gap-2"
                            >
                                {busy === 'unlink-google' ? <><Loader2 className="w-4 h-4 animate-spin" /> Desvinculando...</> : 'Desvincular Google'}
                            </button>
                        )}
                    </div>

                    <div className="space-y-2 border border-[#1a1a2e]/10 rounded-xl p-4">
                        <h2 className="text-[11px] font-black uppercase tracking-widest">Sesiones y Recuperación</h2>
                        <div className="text-[10px] font-bold uppercase opacity-50">
                            Sesiones activas: {accountStatus.sessions === null ? 'N/D' : String(accountStatus.sessions)}
                        </div>
                        <button
                            type="button"
                            onClick={handleRevokeOtherSessions}
                            disabled={busy !== null}
                            className="w-full bg-white border border-[#1a1a2e]/20 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-[#f5f1e8] transition-colors"
                        >
                            {busy === 'revoke-sessions' ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cerrando sesiones</span> : 'Cerrar otras sesiones'}
                        </button>

                        <Link
                            href="/auth/forgot-password"
                            className="block w-full text-center bg-white border border-[#1a1a2e]/20 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#f5f1e8] transition-colors"
                        >
                            Recuperar cuenta
                        </Link>
                    </div>

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
