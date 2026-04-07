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
