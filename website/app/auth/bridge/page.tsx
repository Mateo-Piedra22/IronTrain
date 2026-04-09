import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { AlertTriangle, Check, ExternalLink } from 'lucide-react';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { getSafeMobileRedirectUri } from '../../../src/lib/auth/redirects';
import { validateDisplayName, validateUsername } from '../../../src/lib/moderation';
import { BridgeAppRedirect } from './BridgeAppRedirect';

export const revalidate = 0;

function resolveBridgeErrorMessage(errorParam?: string): string {
    const normalized = (errorParam || '').trim().toLowerCase();
    if (!normalized) return 'No se pudo completar la autenticación.';

    if (normalized.includes('state_mismatch')) {
        return 'La sesión OAuth expiró o cambió de dominio. Reintenta iniciar sesión desde la pantalla anterior.';
    }

    if (normalized.includes('oauth_link_failed') || normalized.includes('link_failed_')) {
        return 'Falló la vinculación/autenticación social. Reintenta e intenta nuevamente.';
    }

    return (errorParam || '').replace(/_/g, ' ');
}

function resolveAuthMethodLabel(method?: string): string {
    if (method === 'google') return 'Google OAuth';
    if (method === 'email') return 'Email + Password';
    return 'Método estándar';
}

function resolveFlowLabel(flow?: string): string {
    if (!flow) return 'Autenticación';
    if (flow === 'sign-in') return 'Login';
    if (flow === 'sign-up') return 'Registro';
    if (flow === 'account') return 'Cuenta';
    if (flow === 'account-link') return 'Vinculación';
    return flow;
}

function resolveStatusLabel(status?: string): string {
    if (!status) return 'success';
    if (status === 'linked') return 'linked';
    if (status === 'success') return 'success';
    return status;
}

async function getAuthenticatedSession() {
    const cookieStore = await cookies();
    const headerStore = await headers();

    const forwardedProto = headerStore.get('x-forwarded-proto');
    const forwardedHost = headerStore.get('x-forwarded-host');
    const host = forwardedHost || headerStore.get('host');
    const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();

    const requestOrigin = host
        ? `${forwardedProto || 'https'}://${host}`
        : (envOrigin || 'http://localhost:3000');

    try {
        const response = await fetch(`${requestOrigin}/api/auth/bridge-session`, {
            method: 'GET',
            headers: {
                cookie: cookieStore.toString(),
                'x-requested-with': 'XMLHttpRequest',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            return null;
        }

        const payload = await response.json().catch(() => null);
        const user = payload?.session?.user;
        if (!user?.id) {
            return null;
        }

        return {
            id: user.id,
            email: user.email || null,
            name: user.name || undefined,
        };
    } catch (error) {
        console.error('[AuthBridge] auth.getSession failed:', error);
        return null;
    }
}

export default async function AuthBridgePage(props: { searchParams?: Promise<{ [key: string]: string | undefined }> }) {
    const searchParams = props.searchParams ? await props.searchParams : undefined;
    const errorMsg = searchParams?.error;
    const flow = searchParams?.flow;
    const method = searchParams?.method;
    const status = searchParams?.status;

    const session = await getAuthenticatedSession();
    if (!session) {
        if (errorMsg) {
            const errorDescription = resolveBridgeErrorMessage(errorMsg);
            return (
                <div className="min-h-screen bg-[#f5f1e8] flex flex-col items-center justify-center p-6 font-mono text-[#1a1a2e]">
                    <div className="w-full max-w-md bg-white border border-[#1a1a2e]/20 p-8 rounded-[2rem] shadow-sm space-y-6 text-center">
                        <div className="mx-auto w-16 h-16 rounded-[1.5rem] bg-red-100 text-red-700 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8" />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl font-black uppercase tracking-tight italic">Acceso no completado</h1>
                            <p className="text-xs opacity-60 leading-relaxed">{errorDescription}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Link
                                href="/auth/sign-in"
                                className="bg-[#1a1a2e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest"
                            >
                                Reintentar login
                            </Link>
                            <Link
                                href="/auth/sign-up"
                                className="bg-white border border-[#1a1a2e]/20 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest"
                            >
                                Crear cuenta
                            </Link>
                        </div>

                        <p className="text-[9px] opacity-40 uppercase tracking-[0.2em]">
                            Flow: {resolveFlowLabel(flow)} · Estado: {status || 'error'}
                        </p>
                    </div>
                </div>
            );
        }

        redirect('/auth/sign-in');
    }

    const cookieStore = await cookies();
    const cookieRedirectUri = cookieStore.get('redirect_uri')?.value;

    const redirectUriFromQuery = typeof searchParams?.redirectUri === 'string' ? searchParams.redirectUri : undefined;

    const redirectUri = getSafeMobileRedirectUri(redirectUriFromQuery)
        ?? getSafeMobileRedirectUri(cookieRedirectUri)
        ?? null;

    const bridgeSource = searchParams?.source === 'app' || searchParams?.source === 'website'
        ? searchParams.source
        : (redirectUri ? 'app' : 'website');
    const bridgeSourceLabel = bridgeSource === 'app' ? 'App / Token Bridge' : 'Website / Perfil';
    const authMethodLabel = resolveAuthMethodLabel(method);
    const flowLabel = resolveFlowLabel(flow);
    const statusLabel = resolveStatusLabel(status);
    const isFirstLoginFlow = flow === 'sign-up';
    const isAccountLinkFlow = flow === 'account-link';

    const profileResult = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, session.id));
    const profile = profileResult[0];

    console.log(`[Bridge] User:${session.id} Email:${session.email} HasProfile:${!!profile} HasUsername:${!!profile?.username}`);

    // ONBOARDING STEP: Set Identity if no profile or no username exists
    // We only show this if the user is NOT an admin or if they explicitly lack a username
    if (!profile || !profile.username) {
        async function setUsernameAction(formData: FormData) {
            'use server';
            const sessionId = session?.id;
            if (!sessionId) return redirect('/auth/sign-in');

            const rawUser = formData.get('username') as string;
            if (!rawUser) return redirect('/auth/bridge?error=Usuario_Requerido');

            const username = rawUser.trim().toLowerCase();

            console.log(`[Bridge] Attempting to set username:${username} for User:${sessionId}`);

            // Unified Rules
            const userValid = validateUsername(username);
            if (!userValid.valid) return redirect(`/auth/bridge?error=${userValid.error?.replace(/ /g, '_')}`);

            // Get display name from form
            const rawDisplayName = formData.get('display_name') as string;
            const displayName = rawDisplayName?.trim() || session.name || 'Atleta Iron';

            const nameValid = validateDisplayName(displayName);
            if (!nameValid.valid) return redirect(`/auth/bridge?error=${nameValid.error?.replace(/ /g, '_')}`);

            // Create or update profile with both username and display name
            // By doing this only here, we ensure the account isn't 'created' in our DB until after the setup
            if (!profile) {
                await db.insert(schema.userProfiles).values({
                    id: sessionId,
                    username,
                    displayName,
                    isPublic: true,
                    updatedAt: new Date()
                });
            } else {
                await db.update(schema.userProfiles).set({
                    username,
                    displayName,
                    updatedAt: new Date()
                }).where(eq(schema.userProfiles.id, sessionId));
            }

            console.log(`[Bridge] Identity set successfully for User:${sessionId}`);

            // Re-run bridge logic
            redirect('/auth/bridge');
        }

        return (
            <div className="min-h-screen bg-[#f5f1e8] flex flex-col items-center justify-center p-6 font-mono text-[#1a1a2e]">
                <div className="w-full max-w-sm">
                    <div className="bg-white border border-[#1a1a2e]/20 p-8 rounded-[2rem] shadow-sm space-y-6">
                        <div className="text-center space-y-2">
                            <h1 className="text-2xl font-black uppercase tracking-tight">Setup Identidad</h1>
                            <p className="text-xs opacity-60 leading-relaxed">
                                Elige tu nombre de usuario público y tu nombre. Todo P2P y progreso estará atado a este ID.
                            </p>

                            <p className="text-[9px] opacity-45 uppercase tracking-[0.25em]">
                                {flowLabel} · {authMethodLabel} · {bridgeSourceLabel}
                            </p>

                            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-left">
                                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <span className="text-[10px] uppercase font-bold text-red-700 tracking-widest leading-relaxed">
                                    Esta acción es permanente. No podrás cambiarlo más adelante.
                                </span>
                            </div>
                        </div>

                        <form action={setUsernameAction} className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Nombre de display</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="display_name"
                                        required
                                        minLength={1}
                                        maxLength={50}
                                        defaultValue={profile?.displayName || session.name || ''}
                                        placeholder="Tu nombre"
                                        className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl px-4 py-4 text-sm font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all"
                                    />
                                </div>
                                <p className="text-[9px] opacity-40 text-center">
                                    Este nombre será visible en tu perfil público
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Username</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 font-bold">@</span>
                                    <input
                                        type="text"
                                        name="username"
                                        required
                                        minLength={3}
                                        maxLength={20}
                                        pattern="[a-z0-9_]+"
                                        title="Solo letras minúsculas, números y guiones bajos (3-20 caracteres)"
                                        placeholder="atleta_iron"
                                        className="w-full bg-[#f5f1e8] border border-[#1a1a2e]/10 rounded-xl pl-10 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-2 ring-[#1a1a2e]/20 transition-all lowercase"
                                    />
                                </div>
                                <p className="text-[9px] opacity-40 text-center">
                                    3-20 caracteres • solo letras minúsculas, números y _
                                </p>
                                {errorMsg && (
                                    <div className="text-[10px] font-bold text-red-600 uppercase mt-2 text-center bg-red-50 p-2 rounded border border-red-100">
                                        {errorMsg === 'Usuario_Requerido' && 'Debes ingresar un nombre de usuario'}
                                        {errorMsg === 'Debe_tener_entre_3_y_20_caracteres' && 'El usuario debe tener entre 3 y 20 caracteres'}
                                        {errorMsg === 'Solo_minusculas_numeros_y_guiones' && 'Solo letras minúsculas, números y guiones bajos (_)'}
                                        {errorMsg === 'Palabra_no_permitida' && 'Esta palabra no está permitida'}
                                        {errorMsg === 'El_usuario_ya_existe_elige_otro' && 'Este usuario ya existe, elige otro'}
                                        {errorMsg !== 'Usuario_Requerido' && errorMsg !== 'Debe_tener_entre_3_y_20_caracteres' && errorMsg !== 'Solo_minusculas_numeros_y_guiones' && errorMsg !== 'Palabra_no_permitida' && errorMsg !== 'El_usuario_ya_existe_elige_otro' && errorMsg.replace(/_/g, ' ')}
                                    </div>
                                )}
                            </div>

                            <button type="submit" className="w-full bg-[#1a1a2e] text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-[0_10px_30px_rgba(0,0,0,0.15)] flex justify-center items-center">
                                Reclamar Identidad
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    const normalizedProfileUsername = String(profile.username || '').trim().replace(/^@+/, '');
    const profileHref = /^[a-z0-9_]{3,20}$/.test(normalizedProfileUsername)
        ? `/user/${normalizedProfileUsername}`
        : '/user/me';

    // NORMAL SUCCESS / REDIRECT BRIDGE
    if (redirectUri) {
        // We generate a temporary exchange code instead of a JWT
        const exchangeCode = randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        await db.insert(schema.authCodes).values({
            code: exchangeCode,
            userId: session.id,
            expiresAt,
        });

        const appUrl = `${redirectUri}${redirectUri.includes('?') ? '&' : '?'}code=${exchangeCode}`;

        return (
            <div className="min-h-screen bg-[#f5f1e8] flex flex-col items-center justify-center p-6 font-mono text-[#1a1a2e]">
                <div className="w-full max-w-sm text-center space-y-10">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full animate-pulse"></div>
                        <div className="relative bg-[#1a1a2e] p-5 rounded-[2.5rem] shadow-2xl">
                            <Check className="w-12 h-12 text-white" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h1 className="text-4xl font-black tracking-tighter uppercase italic">¡Acceso Concedido!</h1>
                        <p className="text-sm opacity-50 max-w-[280px] mx-auto leading-relaxed">
                            {profile.username ? `@${profile.username} ha sido sincronizado.` : 'Tu cuenta ha sido sincronizada.'} Volviendo a la terminal de IronTrain...
                        </p>
                        <p className="text-[9px] opacity-45 uppercase tracking-[0.25em]">
                            {flowLabel} · {authMethodLabel} · {bridgeSourceLabel} · {statusLabel}
                        </p>
                        <p className="text-[10px] opacity-55">
                            Sesión: <span className="font-black">{session.email || `@${profile.username}`}</span>
                        </p>
                    </div>

                    <div className="space-y-4 pt-4">
                        <a
                            href={appUrl}
                            className="block w-full bg-[#1a1a2e] text-white py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-black transition-all shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center justify-center gap-3 active:scale-95 group"
                        >
                            Abrir Aplicación
                            <ExternalLink className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </a>

                        <p className="text-[10px] opacity-30 uppercase tracking-widest">
                            Si no redirige automáticamente, toca el botón arriba
                        </p>

                        <BridgeAppRedirect
                            appUrl={appUrl}
                            label="la app"
                            delayMs={3000}
                            clearRedirectCookie
                        />
                    </div>

                    {/* WEB REDIRECTS (Optional for web users) */}
                    <div className="grid grid-cols-2 gap-3 pt-6 border-t border-[#1a1a2e]/5">
                        <Link
                            href="/feed"
                            className="bg-white/50 border border-[#1a1a2e]/10 py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-white transition-all flex items-center justify-center gap-2"
                        >
                            Ir al Feed
                        </Link>
                        <Link
                            href={profileHref}
                            className="bg-white/50 border border-[#1a1a2e]/10 py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-white transition-all flex items-center justify-center gap-2"
                        >
                            Ver Perfil
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f1e8] flex flex-col items-center justify-center p-6 font-mono text-[#1a1a2e]">
            <div className="w-full max-w-md text-center space-y-8">
                <div className="relative inline-block">
                    <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full animate-pulse" />
                    <div className="relative bg-[#1a1a2e] p-5 rounded-[2.5rem] shadow-2xl">
                        <Check className="w-12 h-12 text-white" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-4xl font-black tracking-tighter uppercase italic">Acceso concedido</h1>
                    <p className="text-sm opacity-60 max-w-[320px] mx-auto leading-relaxed">
                        {isFirstLoginFlow
                            ? `Cuenta creada para ${profile.displayName || `@${profile.username}`}. Configurando acceso inicial y perfil público.`
                            : isAccountLinkFlow
                                ? `Google quedó vinculado para ${profile.displayName || `@${profile.username}`}. Te llevamos a tu perfil para verificar todo.`
                                : `Bienvenido ${profile.displayName || `@${profile.username}`}. Redirigiendo a tu perfil público.`}
                    </p>
                    <p className="text-[9px] opacity-45 uppercase tracking-[0.25em]">
                        {flowLabel} · {authMethodLabel} · {bridgeSourceLabel} · {statusLabel}
                    </p>
                    <p className="text-[10px] opacity-55">
                        Sesión: <span className="font-black">{session.email || `@${profile.username}`}</span>
                    </p>
                </div>

                <div className="space-y-4">
                    <Link
                        href={profileHref}
                        className="block w-full bg-[#1a1a2e] text-white py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-black transition-all shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
                    >
                        Ir a mi perfil
                    </Link>

                    <BridgeAppRedirect targetUrl={profileHref} label="tu perfil" delayMs={2500} />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    <Link
                        href="/feed"
                        className="bg-white/50 border border-[#1a1a2e]/10 py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-white transition-all"
                    >
                        Ir al Feed
                    </Link>
                    <Link
                        href="/auth/account"
                        className="bg-white/50 border border-[#1a1a2e]/10 py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-white transition-all"
                    >
                        Seguridad
                    </Link>
                </div>
            </div>
        </div>
    );
}
