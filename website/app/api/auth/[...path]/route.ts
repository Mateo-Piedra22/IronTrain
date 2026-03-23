import { NextRequest } from 'next/server';
import { auth } from '../../../../src/lib/auth/server';

const handler = auth.handler();

export const GET = async (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) => {
    const p = await params;
    // Provide both path and auth to satisfy both Next.js and the internal logic
    return (handler as any).GET(req, { params: Promise.resolve({ ...p, auth: p.path }) });
};

export const POST = async (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) => {
    const p = await params;
    return (handler as any).POST(req, { params: Promise.resolve({ ...p, auth: p.path }) });
};
