import Link from 'next/link';
import { SignUpFlow } from '../components/SignUpFlow';

export const revalidate = 0;

export default function SignUpPage() {
    return (
        <div className="min-h-screen bg-[#f5f1e8] flex flex-col items-center justify-center p-6 font-mono text-[#1a1a2e]">
            <div className="w-full max-w-sm">
                <div className="bg-white border border-[#1a1a2e]/20 p-8 rounded-[2rem] shadow-sm space-y-6">
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-black uppercase tracking-tight">Sign Up</h1>
                        <p className="text-xs opacity-60 leading-relaxed">Crea tu cuenta y reclama tu identidad.</p>
                    </div>

                    <SignUpFlow />

                    <div className="pt-2 text-center">
                        <Link
                            href="/"
                            className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                        >
                            Volver
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
