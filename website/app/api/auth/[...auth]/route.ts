import { NextRequest } from 'next/server';
import { auth } from '../../../../src/lib/auth/server';

const handler = auth.handler();

export const GET = async (req: NextRequest, { params }: { params: Promise<{ auth: string[] }> }) => {
    const p = await params;
    // INCONSISTENCY FIX:
    // Pasamos el objeto resuelto directamente en lugar de una Promesa
    return (handler as any).GET(req, {
        params: {
            ...p,
            path: p.auth
        }
    });
};

export const POST = async (req: NextRequest, { params }: { params: Promise<{ auth: string[] }> }) => {
    const p = await params;
    return (handler as any).POST(req, {
        params: {
            ...p,
            path: p.auth
        }
    });
};