'use client';

import { Check, Loader2, Plus } from 'lucide-react';
import { useFormStatus } from 'react-dom';

interface AdoptButtonProps {
    isAdopted: boolean;
}

export function AdoptButton({ isAdopted }: AdoptButtonProps) {
    const { pending } = useFormStatus();

    if (isAdopted) {
        return (
            <div className="px-4 py-2 font-black text-[10px] uppercase tracking-widest bg-green-100 text-green-700 border-2 border-green-200 flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(26,26,46,0.1)]">
                ADOPTADO <Check className="w-3 h-3" />
            </div>
        );
    }

    return (
        <button
            type="submit"
            disabled={pending}
            className={`px-4 py-2 font-black text-[10px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_rgba(26,26,46,0.2)] flex items-center gap-2 ${pending
                    ? 'bg-[#1a1a2e]/40 text-[#f5f1e8] cursor-wait'
                    : 'bg-[#1a1a2e] text-[#f5f1e8] hover:bg-red-600 active:translate-y-1 active:shadow-none'
                }`}
        >
            {pending ? (
                <>PROCESANDO <Loader2 className="w-3 h-3 animate-spin" /></>
            ) : (
                <>ADOPTAR <Plus className="w-3 h-3 text-red-600" /></>
            )}
        </button>
    );
}
