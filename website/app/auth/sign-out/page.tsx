'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { performSignOut } from '../../../src/lib/auth/signout';

export default function SignOutPage() {
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;

        const runSignOut = async () => {
            try {
                if (cancelled) return;
                await performSignOut(router);
            } catch {
                if (!cancelled) {
                    window.location.replace('/');
                }
            }
        };

        runSignOut();

        return () => {
            cancelled = true;
        };
    }, [router]);

    return (
        <div className="min-h-screen bg-[#f5f1e8] flex items-center justify-center p-6 font-mono text-[#1a1a2e]">
            <div className="bg-white border border-[#1a1a2e]/20 p-8 rounded-[2rem] shadow-sm text-center space-y-3 w-full max-w-sm">
                <div className="flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <h1 className="text-sm font-black uppercase tracking-widest">Cerrando sesión</h1>
                <p className="text-[10px] opacity-60 uppercase">Un momento, estamos limpiando tu sesión...</p>
            </div>
        </div>
    );
}
