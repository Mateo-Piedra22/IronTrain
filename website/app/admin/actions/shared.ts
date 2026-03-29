'use server';
import { AdminRole, enforceAdminAction, getAdminContext, writeAdminAuditLog } from '../../../src/lib/admin-security';

export { writeAdminAuditLog };

export async function getAuthenticatedAdmin(): Promise<string | null> {
    const admin = await getAdminContext();
    return admin?.userId ?? null;
}

export async function requireAdminAction(params: {
    action: string;
    requiredRole?: AdminRole;
}) {
    return enforceAdminAction(params);
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
