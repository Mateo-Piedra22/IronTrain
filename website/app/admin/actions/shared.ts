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

export function getRedirectPath(formData: FormData, defaultSection?: string) {
    const tab = (formData.get('origin_tab') as string) || 'content';
    const section = (formData.get('origin_section') as string) || defaultSection || '';
    let path = `/admin?tab=${tab}`;
    if (section) path += `&section=${section}`;
    return path;
}
