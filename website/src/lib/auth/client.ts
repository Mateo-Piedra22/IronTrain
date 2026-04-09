'use client';

import { createAuthClient as createDirectAuthClient } from '@neondatabase/auth';
import { createAuthClient as createNextAuthClient } from '@neondatabase/auth/next';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react';

const FALLBACK_NEON_AUTH_DIRECT_URL = 'https://ep-falling-wind-aca65w0x.neonauth.sa-east-1.aws.neon.tech/neondb/auth';

export const authClient = createNextAuthClient();

function resolveDirectAuthBaseUrl(): string {
	const candidates = [
		process.env.NEXT_PUBLIC_NEON_AUTH_DIRECT_URL,
		process.env.NEXT_PUBLIC_NEON_AUTH_SERVICE_URL,
		process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL,
		process.env.NEXT_PUBLIC_NEON_AUTH_URL,
	];

	for (const raw of candidates) {
		const candidate = raw?.trim();
		if (!candidate) continue;

		try {
			const parsed = new URL(candidate);
			if (parsed.pathname.startsWith('/api/auth')) {
				continue;
			}
			const normalizedPath = parsed.pathname.replace(/\/+$/, '');
			if (!normalizedPath || normalizedPath === '/') {
				return parsed.origin;
			}
			return `${parsed.origin}${normalizedPath}`;
		} catch {
			return candidate.replace(/\/+$/, '');
		}
	}

	return FALLBACK_NEON_AUTH_DIRECT_URL;
}

/**
 * directAuthClient points directly to the upstream Neon Auth service.
 * It MUST be used for OAuth sign-in flows (signIn.social) because
 * the Better Auth state cookie must be set on the neon.tech domain before 
 * the browser redirects to Google, otherwise a state_mismatch error will occur.
 *
 * NOTE: linkSocial also needs Neon-domain state cookies, but requires an authenticated
 * user context. In this project we bridge that by obtaining a bearer token from
 * authClient on the app domain and sending it as Authorization when calling
 * directAuthClient.linkSocial.
 */
export const directAuthClient = createDirectAuthClient(resolveDirectAuthBaseUrl(), {
	adapter: BetterAuthReactAdapter(),
});
