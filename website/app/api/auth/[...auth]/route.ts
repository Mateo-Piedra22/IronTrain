import { NextRequest } from 'next/server';
import { auth } from '../../../../src/lib/auth/server';

const handler = auth.handler();

export const GET = async (req: NextRequest, { params }: { params: Promise<{ auth: string[] }> }) => {
    const p = await params;
    // INCONSISTENCY FIX:
    // Next.js 15 expects 'auth' in params because the folder is [...auth].
    // BUT the library runtime logic (v0.2.0-beta.1) internally looks for 'path'.
    // We provide both to satisfy everyone.
    return (handler as any).GET(req, {
        params: Promise.resolve({
            ...p,
            path: p.auth
        })
    });
};

export const POST = async (req: NextRequest, { params }: { params: Promise<{ auth: string[] }> }) => {
    const p = await params;
    return (handler as any).POST(req, {
        params: Promise.resolve({
            ...p,
            path: p.auth
        })
    });
};
