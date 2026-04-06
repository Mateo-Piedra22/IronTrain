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
            fallback();
            return;
        }

        router.replace('/');
        router.refresh();
    } catch {
        fallback();
    }
}
