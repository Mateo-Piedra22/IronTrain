'use client';

import { Sparkles, Star } from 'lucide-react';
import { useFeatureFlagEnabled, useFeatureFlagVariantKey } from 'posthog-js/react';

export function PremiumFeatureBadge() {
    const isBetaEnabled = useFeatureFlagEnabled('beta-ironsocial-features');
    const workoutVariant = useFeatureFlagVariantKey('experiment-workout-design');

    if (!isBetaEnabled && !workoutVariant) return null;

    return (
        <div className="flex flex-col gap-2 mb-4">
            {isBetaEnabled && (
                <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                    <Star className="w-3 h-3 fill-white" /> IronSocial Beta Active
                </div>
            )}

            {workoutVariant === 'test' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-red-600 to-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                    <Sparkles className="w-3 h-3 fill-white" /> Experiment: Modern Design Active
                </div>
            )}
        </div>
    );
}

export function ExperimentWrapper({ children }: { children: React.ReactNode }) {
    const variant = useFeatureFlagVariantKey('experiment-workout-design');

    // If variant is 'test', we apply some "modern" styles
    if (variant === 'test') {
        return (
            <div className="relative group transition-all duration-500 scale-[1.02] border-red-600 shadow-[20px_20px_0px_0px_rgba(220,38,38,0.1)]">
                {children}
            </div>
        );
    }

    return <>{children}</>;
}
