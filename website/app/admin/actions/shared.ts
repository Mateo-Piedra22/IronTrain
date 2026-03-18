'use server';
import { auth } from '../../../src/lib/auth/server';

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);

export async function getAuthenticatedAdmin(): Promise<string | null> {
    try {
        const { data: session } = await auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return null;
        if (ADMIN_USER_IDS.length === 0) return null;
        if (ADMIN_USER_IDS.includes(userId)) return userId;
        return null;
    } catch {
        return null;
    }
}

export async function getRedirectPath(formData: FormData, defaultSection?: string) {
    const tab = (formData.get('origin_tab') as string) || 'content';
    const section = (formData.get('origin_section') as string) || defaultSection || '';
    const id = formData.get('origin_id') as string;

    const params = new URLSearchParams();
    params.set('tab', tab);
    if (section) params.set('section', section);
    if (id) params.set('id', id);

    return `/admin?${params.toString()}`;
}

export type ActionResponse = {
    success: boolean;
    message?: string;
    error?: string;
    data?: any;
};

export async function createActionResponse(success: boolean, message?: string, error?: string): Promise<ActionResponse> {
    return { success, message, error };
}
