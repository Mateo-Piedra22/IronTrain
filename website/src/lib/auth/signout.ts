'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { authClient } from './client';

export async function performSignOut(router: AppRouterInstance): Promise<void> {
    const fallback = () => {
        window.location.replace('/');
    };

    try {
        const { error } = await authClient.signOut();
        if (error) {
            await fetch('/api/internal/auth/signout-hard', {
                method: 'POST',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            }).catch(() => null);
        } else {
            await fetch('/api/internal/auth/signout-hard', {
                method: 'POST',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            }).catch(() => null);
        }

        const sessionCheck = await authClient.getSession().catch(() => null);
        if (sessionCheck?.data?.session) {
            fallback();
            return;
        }

        router.replace('/');
        router.refresh();
    } catch {
        fallback();
    }
}
