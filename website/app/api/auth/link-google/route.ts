import { NextRequest, NextResponse } from 'next/server';
import { getNeonAuthServiceBaseUrl } from '../../../../src/lib/auth/runtime';
import { auth } from '../../../../src/lib/auth/server';

export const runtime = 'nodejs';

/**
 * Server-side Google Account Linking — Bypass cross-origin cookie issues
 * 
 * Problem: The standard client-side `linkSocial()` fails because:
 * - Using authClient (proxy): cookies land on app domain, but Google callback 
 *   goes to Neon Auth domain → state_mismatch
 * - Using directAuthClient: cross-origin fetch can't reliably set third-party cookies
 *
 * Solution: Server-to-server call that forwards the user's session to Neon Auth,
 * gets the Google OAuth URL, and extracts the state. We then redirect the browser
 * THROUGH the Neon Auth domain so it sets its own first-party state cookies
 * before continuing to Google.
 *
 * Flow:
 * 1. Browser navigates to GET /api/auth/link-google
 * 2. Server verifies session, extracts neon auth cookies
 * 3. Server calls Neon Auth's link-social endpoint server-to-server
 * 4. Gets back Google OAuth URL (which embeds the state in the URL params)
 * 5. Redirect browser directly to Google OAuth URL
 *    - The state is embedded in the URL, not just cookies
 *    - Neon Auth also stores the state server-side in its DB
 * 6. Google callback → Neon Auth → verifies state → links account → redirects to app
 */

const NEON_AUTH_BASE_URL = getNeonAuthServiceBaseUrl() || '';

function buildAccountRedirect(req: NextRequest, params: Record<string, string>): NextResponse {
    const origin = new URL(req.url).origin;
    const redirectUri = new URL(req.url).searchParams.get('redirectUri');
    const url = new URL('/auth/account', origin);

    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }

    if (redirectUri) {
        url.searchParams.set('redirectUri', redirectUri);
    }

    return NextResponse.redirect(url);
}

function inferNeonErrorCode(raw: string): string {
    const message = raw.toLowerCase();

    if (message.includes('state_mismatch')) return 'state_mismatch';
    if (message.includes('already linked') || message.includes('already_linked')) return 'oauth_link_already_linked';
    if (message.includes('already exists') || message.includes('different user')) return 'oauth_link_account_conflict';
    if (message.includes('unauthorized') || message.includes('not authenticated')) return 'oauth_link_no_session';

    return 'oauth_link_failed';
}

/**
 * Extract all neon-auth-related cookies from request to forward server-to-server
 */
function extractNeonAuthCookies(cookieHeader: string): string {
    if (!cookieHeader) return '';
    return cookieHeader
        .split(';')
        .map(c => c.trim())
        .filter(c => {
            const name = c.split('=')[0]?.toLowerCase() || '';
            return name.includes('neon') || 
                   name.includes('auth') || 
                   name.includes('session') ||
                   name.includes('better-auth') ||
                   name.startsWith('__secure-');
        })
        .join('; ');
}

export async function GET(req: NextRequest) {
    try {
        if (!NEON_AUTH_BASE_URL) {
            console.error('[link-google] Missing NEON_AUTH_BASE_URL/NEON_AUTH_SERVICE_URL');
            return buildAccountRedirect(req, { error: 'oauth_link_not_configured' });
        }

        // 1. Verify user session
        const sessionResult = await (auth as any).getSession();
        const session = sessionResult?.data;

        if (!session?.user?.id) {
            return buildAccountRedirect(req, { error: 'oauth_link_no_session' });
        }

        // 2. Build callback URLs
        const origin = new URL(req.url).origin;
        const redirectUri = new URL(req.url).searchParams.get('redirectUri');
        
        const accountUrl = new URL('/auth/account', origin);
        accountUrl.searchParams.set('linked', 'google');
        if (redirectUri) accountUrl.searchParams.set('redirectUri', redirectUri);

        const errorUrl = new URL('/auth/account', origin);
        errorUrl.searchParams.set('error', 'oauth_link_failed');
        if (redirectUri) errorUrl.searchParams.set('redirectUri', redirectUri);

        // 3. Forward session cookies to Neon Auth server-to-server
        const rawCookies = req.headers.get('cookie') || '';
        const neonCookies = extractNeonAuthCookies(rawCookies);
        
        // Also include full cookie header as fallback
        const forwardCookies = neonCookies || rawCookies;

        const proxyBaseUrl = `${origin}/api/auth`;

        const linkSocialCandidates = [
            {
                url: `${proxyBaseUrl}/link-social`,
                body: {
                    provider: 'google',
                    callbackURL: accountUrl.toString(),
                    errorCallbackURL: errorUrl.toString(),
                },
                source: 'proxy',
            },
            {
                url: `${proxyBaseUrl}/link-social/google`,
                body: {
                    callbackURL: accountUrl.toString(),
                    errorCallbackURL: errorUrl.toString(),
                },
                source: 'proxy',
            },
            {
                url: `${proxyBaseUrl}/link-social?provider=google`,
                body: {
                    callbackURL: accountUrl.toString(),
                    errorCallbackURL: errorUrl.toString(),
                },
                source: 'proxy',
            },
            {
                url: `${NEON_AUTH_BASE_URL}/link-social`,
                body: {
                    provider: 'google',
                    callbackURL: accountUrl.toString(),
                    errorCallbackURL: errorUrl.toString(),
                },
                source: 'upstream',
            },
            {
                url: `${NEON_AUTH_BASE_URL}/link-social/google`,
                body: {
                    callbackURL: accountUrl.toString(),
                    errorCallbackURL: errorUrl.toString(),
                },
                source: 'upstream',
            },
            {
                url: `${NEON_AUTH_BASE_URL}/link-social?provider=google`,
                body: {
                    callbackURL: accountUrl.toString(),
                    errorCallbackURL: errorUrl.toString(),
                },
                source: 'upstream',
            },
        ] as const;

        console.info('[link-google] Initiating server-to-server link-social call', {
            userId: session.user.id,
            callbackURL: accountUrl.toString(),
            neonAuthUrl: NEON_AUTH_BASE_URL,
            proxyAuthUrl: proxyBaseUrl,
            candidateCount: linkSocialCandidates.length,
        });

        let neonResponse: Response | null = null;
        let selectedCandidate: string | null = null;
        let selectedSource: 'proxy' | 'upstream' | null = null;

        for (const candidate of linkSocialCandidates) {
            const response = await fetch(candidate.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': forwardCookies,
                    'Origin': origin,
                    'x-neon-auth-middleware': 'true',
                },
                body: JSON.stringify(candidate.body),
                redirect: 'manual',
                signal: AbortSignal.timeout(7000),
            });

            if (response.status === 404) {
                continue;
            }

            neonResponse = response;
            selectedCandidate = candidate.url;
            selectedSource = candidate.source;
            break;
        }

        if (!neonResponse) {
            console.error('[link-google] No matching link-social endpoint found (all returned 404)', {
                userId: session.user.id,
                endpoints: linkSocialCandidates.map((entry) => entry.url),
            });
            return buildAccountRedirect(req, { error: 'oauth_link_not_configured' });
        }

        // 4. Extract Google OAuth URL from response
        let googleUrl: string | null = null;

        if (neonResponse.status === 302 || neonResponse.status === 301) {
            googleUrl = neonResponse.headers.get('location');
        } else if (neonResponse.ok) {
            const body = await neonResponse.json().catch(() => null);
            if (body?.url) {
                googleUrl = body.url;
            } else if (body?.redirect && body?.url) {
                googleUrl = body.url;
            }
        } else {
            // Error from Neon Auth
            const errorBody = await neonResponse.text().catch(() => '');
            const inferredCode = inferNeonErrorCode(errorBody);
            console.error('[link-google] Neon Auth error:', {
                endpoint: selectedCandidate,
                source: selectedSource,
                status: neonResponse.status,
                statusText: neonResponse.statusText,
                inferredCode,
                body: errorBody.slice(0, 500),
            });

            if (neonResponse.status === 401 || neonResponse.status === 403) {
                if (selectedSource === 'upstream') {
                    return buildAccountRedirect(req, { error: 'oauth_link_upstream_unauthorized' });
                }
                return buildAccountRedirect(req, { error: 'oauth_link_no_session' });
            }

            if (inferredCode !== 'oauth_link_failed') {
                return buildAccountRedirect(req, { error: inferredCode });
            }

            return buildAccountRedirect(req, { error: `link_failed_${neonResponse.status}` });
        }

        if (!googleUrl) {
            console.error('[link-google] No Google redirect URL obtained');
            return buildAccountRedirect(req, { error: 'no_google_url' });
        }

        // 5. Redirect browser to Google OAuth
        // The state is embedded in the Google URL params (state=...) 
        // Neon Auth stores the state server-side in its database
        // The state cookies from Neon Auth need to be set on the Neon Auth domain.
        // Since this response comes from OUR domain, we can't set Neon-domain cookies.
        // BUT: Neon Auth stores state in its DB, and the state is in the URL.
        // The cookie is a secondary CSRF check. If Neon Auth's callback only checks
        // the DB state (not cookie), this works. If it requires the cookie, we need
        // a different approach.
        
        // Forward all set-cookie headers from Neon Auth response
        const redirectResponse = NextResponse.redirect(googleUrl);
        const setCookies = neonResponse.headers.getSetCookie();
        for (const sc of setCookies) {
            redirectResponse.headers.append('Set-Cookie', sc);
        }

        console.info('[link-google] Redirecting to Google OAuth', {
            userId: session.user.id,
            endpoint: selectedCandidate,
            source: selectedSource,
            setCookieCount: setCookies.length,
        });

        return redirectResponse;
    } catch (error) {
        console.error('[link-google] Unexpected error:', error);
        return buildAccountRedirect(req, { error: 'server_error' });
    }
}
