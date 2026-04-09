'use client';

import { AlertTriangle, ArrowLeft, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { authClient } from '../../../src/lib/auth/client';
import { buildAuthPageUrl, buildSocialLinkCallbackUrl, toAbsoluteAppUrl } from '../../../src/lib/auth/redirects';
import { performSignOut } from '../../../src/lib/auth/signout';

const GOOGLE_GSI_SRC = 'https://accounts.google.com/gsi/client';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_CHANGE_COOLDOWN_DAYS = 30;

function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

function validateEmailInput(value: string): string | null {
    if (!value.trim()) return 'El email es obligatorio';
    if (!EMAIL_REGEX.test(normalizeEmail(value))) return 'Formato de email inválido';
    return null;
}

function validateUsernameInput(value: string): string | null {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return 'El username es obligatorio';
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
        return 'Usa 3-20 caracteres: minúsculas, números y _';
    }
    return null;
}

function validateDisplayNameInput(value: string): string | null {
    const normalized = value.trim();
    if (!normalized) return 'El nombre visible es obligatorio';
    if (normalized.length > 50) return 'Máximo 50 caracteres';
    return null;
}

function validateAuthNameInput(value: string): string | null {
    const normalized = value.trim();
    if (!normalized) return 'El nombre de cuenta es obligatorio';
    if (normalized.length > 80) return 'Máximo 80 caracteres';
    return null;
}

function getPasswordPolicyMessage(password: string): string | null {
    const normalized = password.trim();
    if (!normalized) return 'La contraseña nueva es obligatoria';
    if (normalized.length < 8) return 'Mínimo 8 caracteres';
    if (!/[a-z]/.test(normalized) || !/[A-Z]/.test(normalized)) return 'Incluye mayúsculas y minúsculas';
    if (!/[0-9]/.test(normalized)) return 'Incluye al menos 1 número';
    return null;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

function formatDateShort(value: Date | null): string | null {
    if (!value) return null;
    if (Number.isNaN(value.getTime())) return null;
    try {
        return new Intl.DateTimeFormat('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(value);
    } catch {
        return null;
    }
}

function getOAuthLinkErrorMessage(authError: string): string | null {
    if (!authError) return null;

    if (authError.includes('state_mismatch')) {
        return 'La sesión OAuth de vinculación expiró o cambió de dominio. Reintenta vincular Google desde esta pantalla.';
    }

    if (authError.includes('oauth_link_requires_custom_domain')) {
        return 'Tu configuración actual de Auth requiere un dominio personalizado compartido para vincular Google. Contacta soporte o ajusta la configuración de Neon Auth.';
    }

    if (authError.includes('oauth_link_account_conflict')) {
        return 'Esa cuenta de Google ya está vinculada a otro usuario. Inicia sesión con tu método original y usa otra cuenta de Google.';
    }

    if (authError.includes('oauth_link_already_linked')) {
        return 'Google ya está vinculado a esta cuenta.';
    }

    if (authError.includes('oauth_link_no_session')) {
        return 'Tu sesión expiró antes de iniciar la vinculación. Inicia sesión nuevamente e inténtalo otra vez.';
    }

    if (authError.includes('oauth_link_upstream_unauthorized')) {
        return 'No se pudo validar la sesión en el servicio de autenticación para vincular Google. Intenta nuevamente; si persiste, usa Sign In con Google y luego verifica el vínculo.';
    }

    if (authError.includes('oauth_link_not_configured')) {
        return 'La vinculación con Google no está configurada correctamente en el servidor.';
    }

    if (authError.includes('link_failed_')) {
        return 'El servicio de autenticación rechazó la vinculación con Google. Intenta nuevamente en unos segundos.';
    }

    if (authError.includes('oauth_link_failed') || authError.includes('no_google_url') || authError.includes('server_error')) {
        return 'No se pudo completar la vinculación con Google. Intenta nuevamente.';
    }

    return null;
}

function getGoogleClientId(): string | null {
    const value = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

async function loadGoogleIdentityScript(): Promise<void> {
    if (typeof window === 'undefined') {
        throw new Error('Browser-only flow');
    }

    if ((window as any).google?.accounts?.id) {
        return;
    }

    const existing = document.querySelector(`script[src="${GOOGLE_GSI_SRC}"]`) as HTMLScriptElement | null;
    if (existing) {
        await new Promise<void>((resolve, reject) => {
            if ((window as any).google?.accounts?.id) {
                resolve();
                return;
            }

            const onLoad = () => resolve();
            const onError = () => reject(new Error('No se pudo cargar Google Identity Services'));
            existing.addEventListener('load', onLoad, { once: true });
            existing.addEventListener('error', onError, { once: true });
        });
        return;
    }

    await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = GOOGLE_GSI_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
        document.head.appendChild(script);
    });
}

async function requestGoogleIdToken(clientId: string): Promise<string> {
    await loadGoogleIdentityScript();

    const gsi = (window as any).google?.accounts?.id;
    if (!gsi) {
        throw new Error('Google Identity no está disponible');
    }

    return await new Promise<string>((resolve, reject) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error('No se pudo obtener credencial de Google (timeout)'));
        }, 20000);

        gsi.initialize({
            client_id: clientId,
            callback: (response: { credential?: string }) => {
                if (settled) return;
                const token = response?.credential;
                if (!token) {
                    settled = true;
                    window.clearTimeout(timeout);
                    reject(new Error('Google no devolvió credencial válida'));
                    return;
                }
                settled = true;
                window.clearTimeout(timeout);
                resolve(token);
            },
        });

        gsi.prompt((notification: {
            isNotDisplayed?: () => boolean;
            isSkippedMoment?: () => boolean;
            isDismissedMoment?: () => boolean;
        }) => {
            if (settled) return;
            const notDisplayed = Boolean(notification?.isNotDisplayed?.());
            const skipped = Boolean(notification?.isSkippedMoment?.());
            const dismissed = Boolean(notification?.isDismissedMoment?.());
            if (notDisplayed || skipped || dismissed) {
                settled = true;
                window.clearTimeout(timeout);
                reject(new Error('Google no mostró el prompt de credencial'));
            }
        });
    });
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
    const [savedProfileUsername, setSavedProfileUsername] = useState('');
    const [profileLastUsernameChangeAt, setProfileLastUsernameChangeAt] = useState<string | null>(null);
    const [profilePublic, setProfilePublic] = useState(true);
    const [authName, setAuthName] = useState('');
    const [accountEmail, setAccountEmail] = useState('');
    const [accountStatus, setAccountStatus] = useState<{ googleLinked: boolean; sessions: number | null }>({
        googleLinked: false,
        sessions: null,
    });

    const normalizedAccountEmail = useMemo(() => normalizeEmail(accountEmail), [accountEmail]);
    const normalizedVerifyEmail = useMemo(() => normalizeEmail(verifyEmail), [verifyEmail]);
    const normalizedNewEmail = useMemo(() => normalizeEmail(newEmail), [newEmail]);
    const trimmedCurrentPassword = useMemo(() => currentPassword.trim(), [currentPassword]);
    const trimmedNewPassword = useMemo(() => newPassword.trim(), [newPassword]);
    const trimmedDisplayName = useMemo(() => profileDisplayName.trim(), [profileDisplayName]);
    const normalizedProfileUsername = useMemo(() => profileUsername.trim().toLowerCase(), [profileUsername]);
    const normalizedSavedProfileUsername = useMemo(() => savedProfileUsername.trim().toLowerCase(), [savedProfileUsername]);
    const isUsernameChanging = useMemo(
        () => normalizedProfileUsername !== normalizedSavedProfileUsername,
        [normalizedProfileUsername, normalizedSavedProfileUsername]
    );

    const hasVerifiedEmail = useMemo(() => {
        const user = session?.user as Record<string, unknown> | undefined;
        if (!user) return false;

        if (typeof user.emailVerified === 'boolean') return user.emailVerified;
        if (typeof user.email_verified === 'boolean') return user.email_verified;
        if (typeof user.verified === 'boolean') return user.verified;

        if (typeof user.emailVerifiedAt === 'string' && user.emailVerifiedAt.length > 0) return true;
        if (typeof user.email_verified_at === 'string' && user.email_verified_at.length > 0) return true;

        return false;
    }, [session]);

    const usernameCooldownDaysRemaining = useMemo(() => {
        if (!profileLastUsernameChangeAt || !isUsernameChanging) return 0;

        const lastChangeDate = new Date(profileLastUsernameChangeAt);
        if (Number.isNaN(lastChangeDate.getTime())) return 0;

        const diffMs = Date.now() - lastChangeDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const daysRemaining = USERNAME_CHANGE_COOLDOWN_DAYS - diffDays;

        return daysRemaining > 0 ? daysRemaining : 0;
    }, [profileLastUsernameChangeAt, isUsernameChanging]);

    const nextUsernameChangeDate = useMemo(() => {
        if (!profileLastUsernameChangeAt) return null;
        const lastChangeDate = new Date(profileLastUsernameChangeAt);
        if (Number.isNaN(lastChangeDate.getTime())) return null;
        const nextDate = new Date(lastChangeDate);
        nextDate.setDate(nextDate.getDate() + USERNAME_CHANGE_COOLDOWN_DAYS);
        return nextDate;
    }, [profileLastUsernameChangeAt]);

    const nextUsernameChangeDateLabel = useMemo(() => formatDateShort(nextUsernameChangeDate), [nextUsernameChangeDate]);
    const trimmedAuthName = useMemo(() => authName.trim(), [authName]);
    const trimmedDeletePassword = useMemo(() => deletePassword.trim(), [deletePassword]);

    const verifyEmailError = useMemo(() => validateEmailInput(verifyEmail), [verifyEmail]);
    const verifyEmailRestrictionError = useMemo(() => {
        if (!normalizedAccountEmail) return 'No hay email principal en la sesión actual';
        if (normalizedVerifyEmail !== normalizedAccountEmail) return 'Debes verificar el email principal actual de la cuenta';
        if (hasVerifiedEmail) return 'Este email ya está verificado';
        return null;
    }, [hasVerifiedEmail, normalizedAccountEmail, normalizedVerifyEmail]);
    const newEmailError = useMemo(() => {
        const formatError = validateEmailInput(newEmail);
        if (formatError) return formatError;
        if (normalizedNewEmail === normalizedAccountEmail) return 'El nuevo email debe ser diferente al actual';
        return null;
    }, [newEmail, normalizedAccountEmail, normalizedNewEmail]);

    const currentPasswordError = useMemo(() => {
        if (!trimmedCurrentPassword) return 'La contraseña actual es obligatoria';
        if (trimmedCurrentPassword.length < 8) return 'La contraseña actual debe tener al menos 8 caracteres';
        return null;
    }, [trimmedCurrentPassword]);

    const newPasswordError = useMemo(() => {
        const policyError = getPasswordPolicyMessage(newPassword);
        if (policyError) return policyError;
        if (trimmedCurrentPassword && trimmedCurrentPassword === trimmedNewPassword) {
            return 'La nueva contraseña debe ser distinta de la actual';
        }
        return null;
    }, [newPassword, trimmedCurrentPassword, trimmedNewPassword]);

    const profileDisplayNameError = useMemo(() => validateDisplayNameInput(profileDisplayName), [profileDisplayName]);
    const profileUsernameError = useMemo(() => validateUsernameInput(profileUsername), [profileUsername]);
    const profileUsernameRestrictionError = useMemo(() => {
        if (usernameCooldownDaysRemaining <= 0) return null;
        return `Solo podés cambiar tu username una vez cada ${USERNAME_CHANGE_COOLDOWN_DAYS} días. Faltan ${usernameCooldownDaysRemaining} días.`;
    }, [usernameCooldownDaysRemaining]);
    const authNameError = useMemo(() => validateAuthNameInput(authName), [authName]);
    const deletePasswordError = useMemo(() => {
        if (!trimmedDeletePassword) return 'Debes ingresar tu contraseña actual';
        if (trimmedDeletePassword.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
        return null;
    }, [trimmedDeletePassword]);

    const canSendVerification = !verifyEmailError && !verifyEmailRestrictionError;
    const canChangeEmail = !newEmailError;
    const canChangePassword = !currentPasswordError && !newPasswordError;
    const canUpdateProfileIdentity = !profileDisplayNameError && !profileUsernameError && !profileUsernameRestrictionError;
    const canUpdateAuthName = !authNameError;
    const canDeleteAccount = !deletePasswordError;

    const panelClass = (isActive: boolean) =>
        `space-y-2 border border-[#1a1a2e]/10 rounded-xl p-4 transition-all duration-300 ${
            isActive ? 'ring-2 ring-[#1a1a2e]/20 shadow-md bg-[#fcfaf6]' : 'hover:shadow-sm hover:-translate-y-[1px]'
        }`;

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
    const refreshAccountStatus = async (): Promise<boolean | null> => {
        try {
            const authAny = authClient as any;
            const listAccounts = authAny?.listAccounts;
            if (typeof listAccounts === 'function') {
                const result = await listAccounts();
                const accounts = Array.isArray(result?.data) ? result.data : [];
                const googleLinked = accounts.some((acc: any) => String(acc?.providerId || '').toLowerCase() === 'google');
                setAccountStatus((prev) => ({
                    ...prev,
                    googleLinked,
                }));
                return googleLinked;
            }
        } catch {
        }

        return null;
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
                setSavedProfileUsername(String(profile.username || ''));
                setProfileLastUsernameChangeAt(profile.lastUsernameChangeAt ? String(profile.lastUsernameChangeAt) : null);
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

    const callbackURL = useMemo(
        () => toAbsoluteAppUrl(
            buildAuthPageUrl('/auth/bridge', searchParams.get('redirectUri'), {
                source: 'website',
                flow: 'account',
                method: 'email',
                status: 'success',
            })
        ),
        [searchParams]
    );

    const socialCallbackURL = useMemo(
        () => toAbsoluteAppUrl(
            buildAuthPageUrl('/auth/bridge', searchParams.get('redirectUri'), {
                source: 'website',
                flow: 'account-link',
                method: 'google',
                status: 'linked',
            })
        ),
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

    const accountBackHref = useMemo(() => {
        const normalizedUsername = profileUsername.trim().replace(/^@+/, '');
        if (/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
            return `/user/${normalizedUsername}`;
        }
        return '/user/me';
    }, [profileUsername]);

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

        const mappedMessage = getOAuthLinkErrorMessage(authError);
        if (mappedMessage) {
            setError(mappedMessage);
        }
    }, [searchParams, socialLinkCallbackURL, socialLinkErrorCallbackURL]);

    useEffect(() => {
        if (searchParams.get('linked') === 'google') {
            // After returning from Google OAuth, verify the link actually happened
            // then show success message
            const verifyAndConfirm = async () => {
                const linked = await refreshAccountStatus();

                if (linked) {
                    setSuccess('Google vinculado correctamente. Ya puedes iniciar sesión con ambos métodos.');
                    setError(null);
                } else {
                    setSuccess(null);
                    setError('El flujo con Google regresó, pero no se confirmó la vinculación. Reintenta desde esta pantalla.');
                }

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

        if (verifyEmailError) {
            setError(verifyEmailError);
            return;
        }

        if (verifyEmailRestrictionError) {
            setError(verifyEmailRestrictionError);
            return;
        }

        setBusy('verify');

        try {
            const { error: apiError } = await authClient.sendVerificationEmail({
                email: normalizedVerifyEmail,
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

        if (newEmailError) {
            setError(newEmailError);
            return;
        }

        setBusy('email');

        try {
            const { error: apiError } = await authClient.changeEmail({
                newEmail: normalizedNewEmail,
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

        if (currentPasswordError) {
            setError(currentPasswordError);
            return;
        }

        if (newPasswordError) {
            setError(newPasswordError);
            return;
        }

        setBusy('password');

        try {
            const { error: apiError } = await authClient.changePassword({
                currentPassword: trimmedCurrentPassword,
                newPassword: trimmedNewPassword,
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

        if (profileDisplayNameError) {
            setError(profileDisplayNameError);
            return;
        }

        if (profileUsernameError) {
            setError(profileUsernameError);
            return;
        }

        if (profileUsernameRestrictionError) {
            setError(profileUsernameRestrictionError);
            return;
        }

        setBusy('profile-identity');

        try {
            const response = await fetch('/api/social/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    displayName: trimmedDisplayName,
                    username: normalizedProfileUsername,
                    isPublic: profilePublic,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'No se pudo actualizar el perfil');
            }

            setProfileDisplayName(trimmedDisplayName);
            setProfileUsername(normalizedProfileUsername);
            if (isUsernameChanging) {
                setSavedProfileUsername(normalizedProfileUsername);
                setProfileLastUsernameChangeAt(new Date().toISOString());
            }
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

        if (authNameError) {
            setError(authNameError);
            return;
        }

        setBusy('auth-name');

        try {
            const { error: apiError } = await authClient.updateUser({ name: trimmedAuthName });
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
            const authAny = authClient as any;
            const linkSocial = authAny?.linkSocial;
            const googleClientId = getGoogleClientId();

            if (googleClientId && typeof linkSocial === 'function') {
                try {
                    const idToken = await requestGoogleIdToken(googleClientId);
                    const { error: linkError } = await linkSocial({
                        provider: 'google',
                        idToken: { token: idToken },
                        disableRedirect: true,
                        callbackURL: socialLinkCallbackURL,
                        errorCallbackURL: socialLinkErrorCallbackURL,
                    });

                    if (!linkError) {
                        const linked = await refreshAccountStatus();
                        if (linked) {
                            setSuccess('Google vinculado correctamente. Ya puedes iniciar sesión con ambos métodos.');
                            setError(null);
                            setBusy(null);
                            return;
                        }
                    } else {
                        const rawError = String((linkError as any)?.code || (linkError as any)?.message || '').toLowerCase();
                        const mapped = getOAuthLinkErrorMessage(rawError);
                        if (mapped) {
                            setError(mapped);
                            setBusy(null);
                            return;
                        }
                    }
                } catch (idTokenError) {
                    if (process.env.NODE_ENV === 'production') {
                        console.info('[auth/account] Google ID token linking fallback failed, trying redirect flow', {
                            message: getErrorMessage(idTokenError, 'unknown'),
                        });
                    }
                }
            }

            setError('No se pudo completar la vinculación desde Google Identity en este navegador. Verifica popups/cookies de terceros y reintenta.');
            setBusy(null);
            return;
        } catch (err) {
            console.error('[auth/account] linkGoogle navigation error:', err);
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

        if (deletePasswordError) {
            setError(deletePasswordError);
            return;
        }

        const confirmed = window.confirm('Esta acción eliminará tu cuenta y datos de forma irreversible. ¿Deseas continuar?');
        if (!confirmed) {
            return;
        }

        setBusy('delete');

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
                <Link href={accountBackHref} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">
                    <ArrowLeft className="w-3 h-3" /> Volver
                </Link>

                <div className="bg-white border border-[#1a1a2e]/20 p-8 rounded-[2rem] shadow-sm space-y-6">
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-black uppercase tracking-tight">Seguridad de Cuenta</h1>
                        <p className="text-xs opacity-60 leading-relaxed">Gestiona verificación, email, contraseña y eliminación total.</p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] font-bold text-red-600 uppercase text-center shadow-sm transition-all duration-300">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-[10px] font-bold text-green-700 uppercase text-center flex items-center justify-center gap-2 shadow-sm transition-all duration-300">
                            <Check className="w-4 h-4" /> {success}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-[9px] uppercase tracking-wider">
                        <div className="rounded-xl border border-[#1a1a2e]/10 bg-[#f8f5ee] px-3 py-2 font-black transition-all duration-300 hover:shadow-sm">
                            Email: {hasVerifiedEmail ? 'VERIFICADO' : 'PENDIENTE'}
                        </div>
                        <div className="rounded-xl border border-[#1a1a2e]/10 bg-[#f8f5ee] px-3 py-2 font-black transition-all duration-300 hover:shadow-sm">
                            Google: {accountStatus.googleLinked ? 'VINCULADO' : 'NO VINCULADO'}
                        </div>
                        <div className="rounded-xl border border-[#1a1a2e]/10 bg-[#f8f5ee] px-3 py-2 font-black transition-all duration-300 hover:shadow-sm col-span-2">
                            Sesiones activas: {accountStatus.sessions === null ? 'N/D' : String(accountStatus.sessions)}
                        </div>
                    </div>

                    <form onSubmit={handleUpdateAuthName} className={panelClass(busy === 'auth-name')}>
                        <h2 className="text-[11px] font-black uppercase tracking-widest">[P1] Cuenta Auth</h2>
                        <p className="text-[10px] font-bold uppercase opacity-50">Identidad principal de acceso y estado real de verificación.</p>
                        <input
                            type="text"
                            value={authName}
                            onChange={(e) => setAuthName(e.target.value)}
                            required
                            minLength={1}
                            maxLength={80}
                            placeholder="Nombre de cuenta"
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                        />
                        <div className="flex items-center justify-between text-[9px] uppercase tracking-wider">
                            <span className={authNameError ? 'text-red-600 font-black' : 'opacity-40 font-bold'}>{authNameError || 'Nombre listo para guardar'}</span>
                            <span className="opacity-30 font-black">{trimmedAuthName.length}/80</span>
                        </div>
                        <input
                            type="email"
                            value={accountEmail}
                            readOnly
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold opacity-70"
                        />
                        <div className="text-[9px] uppercase tracking-wider font-black opacity-50">
                            Estado de verificación: {hasVerifiedEmail ? 'VERIFICADO' : 'PENDIENTE'}
                        </div>
                        <button type="submit" disabled={busy !== null || !canUpdateAuthName} className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex justify-center items-center gap-2 transition-all hover:scale-[1.01]">
                            {busy === 'auth-name' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualizar nombre de cuenta'}
                        </button>
                    </form>

                    <form onSubmit={handleSendVerification} className={panelClass(busy === 'verify')}>
                        <h2 className="text-[11px] font-black uppercase tracking-widest">[P2] Verificar Email</h2>
                        <p className="text-[10px] font-bold uppercase opacity-50">Reenvía email de verificación para mantener la cuenta confirmada.</p>
                        <input
                            type="email"
                            value={verifyEmail}
                            onChange={(e) => setVerifyEmail(e.target.value)}
                            required
                            disabled={hasVerifiedEmail}
                            placeholder="email@ejemplo.com"
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                        />
                        <div className="flex items-center justify-between text-[9px] uppercase tracking-wider">
                            <span className={verifyEmailError || verifyEmailRestrictionError ? 'text-red-600 font-black' : 'opacity-40 font-bold'}>
                                {verifyEmailError || verifyEmailRestrictionError || 'Formato correcto'}
                            </span>
                            <span className="opacity-30 font-black">{normalizedVerifyEmail.length}/120</span>
                        </div>
                        <button type="submit" disabled={busy !== null || !canSendVerification} className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex justify-center items-center gap-2 transition-all hover:scale-[1.01]">
                            {busy === 'verify' ? <Loader2 className="w-4 h-4 animate-spin" /> : hasVerifiedEmail ? 'Email ya verificado' : 'Enviar verificación'}
                        </button>
                    </form>

                    <form onSubmit={handleChangeEmail} className={panelClass(busy === 'email')}>
                        <h2 className="text-[11px] font-black uppercase tracking-widest">[P2] Cambiar Email</h2>
                        <p className="text-[10px] font-bold uppercase opacity-50">Solicita cambio al email principal. Requiere confirmación por correo.</p>
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            required
                            placeholder="nuevo@email.com"
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                        />
                        <div className="flex items-center justify-between text-[9px] uppercase tracking-wider">
                            <span className={newEmailError ? 'text-red-600 font-black' : 'opacity-40 font-bold'}>{newEmailError || 'Listo para solicitar'}</span>
                            <span className="opacity-30 font-black">Actual: {normalizedAccountEmail || 'N/D'}</span>
                        </div>
                        <button type="submit" disabled={busy !== null || !canChangeEmail} className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex justify-center items-center gap-2 transition-all hover:scale-[1.01]">
                            {busy === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Solicitar cambio'}
                        </button>
                    </form>

                    <form onSubmit={handleChangePassword} className={panelClass(busy === 'password')}>
                        <h2 className="text-[11px] font-black uppercase tracking-widest">[P2] Cambiar Contraseña</h2>
                        <p className="text-[10px] font-bold uppercase opacity-50">Mínimo 8 caracteres con mayúsculas, minúsculas y números.</p>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                            minLength={8}
                            placeholder="Contraseña actual"
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                        />
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                            placeholder="Nueva contraseña"
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                        />
                        <div className="grid grid-cols-2 gap-2 text-[9px] uppercase tracking-wider">
                            <span className={currentPasswordError ? 'text-red-600 font-black' : 'opacity-40 font-bold'}>{currentPasswordError || 'Actual: OK'}</span>
                            <span className={newPasswordError ? 'text-red-600 font-black text-right' : 'opacity-40 font-bold text-right'}>{newPasswordError || 'Nueva: OK'}</span>
                        </div>
                        <button type="submit" disabled={busy !== null || !canChangePassword} className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex justify-center items-center gap-2 transition-all hover:scale-[1.01]">
                            {busy === 'password' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualizar contraseña'}
                        </button>
                    </form>

                    <div className={panelClass(busy === 'link-google' || busy === 'unlink-google')}>
                        <h2 className="text-[11px] font-black uppercase tracking-widest">[P3] Login Social</h2>
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
                                    className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-black transition-all hover:scale-[1.01] flex justify-center items-center gap-2"
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
                                className="w-full bg-white border border-[#1a1a2e]/20 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-[#f5f1e8] transition-all hover:scale-[1.01] flex justify-center items-center gap-2"
                            >
                                {busy === 'unlink-google' ? <><Loader2 className="w-4 h-4 animate-spin" /> Desvinculando...</> : 'Desvincular Google'}
                            </button>
                        )}
                    </div>

                    <div className={panelClass(busy === 'revoke-sessions')}>
                        <h2 className="text-[11px] font-black uppercase tracking-widest">[P3] Sesiones y Recuperación</h2>
                        <div className="text-[10px] font-bold uppercase opacity-50">
                            Sesiones activas: {accountStatus.sessions === null ? 'N/D' : String(accountStatus.sessions)}
                        </div>
                        <button
                            type="button"
                            onClick={handleRevokeOtherSessions}
                            disabled={busy !== null}
                            className="w-full bg-white border border-[#1a1a2e]/20 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-[#f5f1e8] transition-all hover:scale-[1.01]"
                        >
                            {busy === 'revoke-sessions' ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cerrando sesiones</span> : 'Cerrar otras sesiones'}
                        </button>

                        <Link
                            href="/auth/forgot-password"
                            className="block w-full text-center bg-white border border-[#1a1a2e]/20 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#f5f1e8] transition-all hover:scale-[1.01]"
                        >
                            Recuperar cuenta
                        </Link>
                    </div>

                    <form onSubmit={handleUpdateProfileIdentity} className={panelClass(busy === 'profile-identity')}>
                        <h2 className="text-[11px] font-black uppercase tracking-widest">[P4] Perfil Público (IronTrain)</h2>
                        <p className="text-[10px] font-bold uppercase opacity-50">Visible para la comunidad. El username tiene restricciones reales de tiempo.</p>
                        <input
                            type="text"
                            value={profileDisplayName}
                            onChange={(e) => setProfileDisplayName(e.target.value)}
                            required
                            minLength={1}
                            maxLength={50}
                            placeholder="Nombre visible"
                            className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                        />
                        <div className="flex items-center justify-between text-[9px] uppercase tracking-wider">
                            <span className={profileDisplayNameError ? 'text-red-600 font-black' : 'opacity-40 font-bold'}>{profileDisplayNameError || 'Nombre visible OK'}</span>
                            <span className="opacity-30 font-black">{trimmedDisplayName.length}/50</span>
                        </div>
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
                                className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl pl-8 pr-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                            />
                        </div>
                        <div className="flex items-center justify-between text-[9px] uppercase tracking-wider">
                            <span className={profileUsernameError || profileUsernameRestrictionError ? 'text-red-600 font-black' : 'opacity-40 font-bold'}>
                                {profileUsernameError || profileUsernameRestrictionError || 'Username disponible para guardar'}
                            </span>
                            <span className="opacity-30 font-black">{normalizedProfileUsername.length}/20</span>
                        </div>
                        {nextUsernameChangeDateLabel && (
                            <div className="text-[9px] uppercase tracking-wider font-black opacity-50">
                                Próximo cambio disponible: {nextUsernameChangeDateLabel}
                                {usernameCooldownDaysRemaining > 0 ? ` (${usernameCooldownDaysRemaining} días restantes)` : ''}
                            </div>
                        )}
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-70">
                            <input
                                type="checkbox"
                                checked={profilePublic}
                                onChange={(e) => setProfilePublic(e.target.checked)}
                                className="accent-[#1a1a2e]"
                            />
                            Perfil público
                        </label>
                        <button type="submit" disabled={busy !== null || !canUpdateProfileIdentity} className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex justify-center items-center gap-2 transition-all hover:scale-[1.01]">
                            {busy === 'profile-identity' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar perfil'}
                        </button>
                    </form>

                    <div className={panelClass(busy === 'export' || busy === 'deactivate')}>
                        <h2 className="text-[11px] font-black uppercase tracking-widest">[P5] Privacidad y Portabilidad</h2>
                        <button
                            type="button"
                            onClick={handleExportData}
                            disabled={busy !== null}
                            className="w-full bg-white border border-[#1a1a2e]/20 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-[#f5f1e8] transition-all hover:scale-[1.01]"
                        >
                            {busy === 'export' ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Exportando</span> : 'Exportar mis datos'}
                        </button>
                        <button
                            type="button"
                            onClick={handleDeactivateAccount}
                            disabled={busy !== null}
                            className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-black transition-all hover:scale-[1.01]"
                        >
                            {busy === 'deactivate' ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Desactivando</span> : 'Desactivar cuenta'}
                        </button>
                    </div>

                    <form onSubmit={handleDeleteAccount} className="space-y-2 border border-red-200 bg-red-50 rounded-xl p-4 transition-all duration-300 hover:shadow-sm">
                        <h2 className="text-[11px] font-black uppercase tracking-widest text-red-700 flex items-center gap-2">[P6] <AlertTriangle className="w-4 h-4" /> Eliminar Cuenta Total</h2>
                        <p className="text-[10px] font-bold uppercase opacity-60">
                            Borra datos de app y elimina la cuenta auth de forma irreversible.
                        </p>
                        <input
                            type="password"
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            required
                            placeholder="Contraseña actual"
                            className="w-full bg-white border border-red-200 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 ring-red-300 transition-all"
                        />
                        <div className="flex items-center justify-between text-[9px] uppercase tracking-wider">
                            <span className={deletePasswordError ? 'text-red-600 font-black' : 'text-green-700 font-black'}>{deletePasswordError || 'Contraseña válida para confirmar'}</span>
                            <span className="opacity-40 font-black">Requiere confirmación</span>
                        </div>
                        <button type="submit" disabled={busy !== null || !canDeleteAccount} className="w-full bg-red-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex justify-center items-center gap-2 hover:bg-red-700 transition-all hover:scale-[1.01]">
                            {busy === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar cuenta'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
