'use client';

import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react';

function resolveAuthBaseUrl(): string {
	if (typeof window !== 'undefined' && window.location?.origin) {
		return `${window.location.origin}/api/auth`;
	}

	const envAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
	if (envAppUrl) {
		return `${envAppUrl.replace(/\/$/, '')}/api/auth`;
	}

	return 'http://localhost:3000/api/auth';
}

export const authClient = createAuthClient(resolveAuthBaseUrl(), {
	adapter: BetterAuthReactAdapter(),
});
