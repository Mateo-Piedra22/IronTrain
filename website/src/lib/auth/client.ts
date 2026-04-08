'use client';

import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react';

function resolveAuthBaseUrl(): string {
	const envAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
	if (envAppUrl) {
		try {
			const canonical = new URL(envAppUrl);
			return `${canonical.origin}/api/auth`;
		} catch {
			return `${envAppUrl.replace(/\/$/, '')}/api/auth`;
		}
	}

	if (typeof window !== 'undefined' && window.location?.origin) {
		return `${window.location.origin}/api/auth`;
	}

	return 'http://localhost:3000/api/auth';
}

export const authClient = createAuthClient(resolveAuthBaseUrl(), {
	adapter: BetterAuthReactAdapter(),
});

/**
 * directAuthClient points directly to the upstream Neon Auth service.
 * It MUST be used for OAuth sign-in flows (signIn.social) because
 * the Better Auth state cookie must be set on the neon.tech domain before 
 * the browser redirects to Google, otherwise a state_mismatch error will occur.
 *
 * NOTE: linkSocial should use authClient (proxied /api/auth) because it requires
 * an existing authenticated session from the current app domain.
 */
export const directAuthClient = createAuthClient('https://ep-falling-wind-aca65w0x.neonauth.sa-east-1.aws.neon.tech/neondb/auth', {
	adapter: BetterAuthReactAdapter(),
});
