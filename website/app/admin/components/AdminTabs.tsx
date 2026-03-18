'use client';

import {
    Bell,
    Database,
    LayoutDashboard,
    Share2,
    ShieldAlert,
    ShoppingBag
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

interface AdminTabsProps {
    statusPanel: React.ReactNode;
    socialPanel: React.ReactNode;
    contentPanel: React.ReactNode;
    moderationPanel: React.ReactNode;
    marketplacePanel: React.ReactNode;
    syncPanel: React.ReactNode;
}

export default function AdminTabs({
    statusPanel,
    socialPanel,
    contentPanel,
    moderationPanel,
    marketplacePanel,
    syncPanel
}: AdminTabsProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = (searchParams.get('tab') as 'status' | 'social' | 'content' | 'moderation' | 'marketplace' | 'sync') || 'status';

    const setActiveTab = (tab: string) => {
        // Clear all sub-parameters when switching main tabs to prevent "jumping" or inconsistent states
        const params = new URLSearchParams();
        params.set('tab', tab);
        router.push(`?${params.toString()}`, { scroll: false });
    };

    const tabs = [
        { id: 'status', label: 'ESTADO_SISTEMA', icon: LayoutDashboard },
        { id: 'marketplace', label: 'MARKETPLACE_CATALOG', icon: ShoppingBag },
        { id: 'social', label: 'IRONSOCIAL_MGMT', icon: Share2 },
        { id: 'content', label: 'PUBLICADOR_UNIFICADO', icon: Bell },
        { id: 'moderation', label: 'MODERACION_COMUNIDAD', icon: ShieldAlert },
        { id: 'sync', label: 'SYNC_WORKOUTS', icon: Database },
    ] as const;

    return (
        <div className="space-y-8">
            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 border-2 border-[#1a1a2e] p-2 bg-[#1a1a2e]">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 font-black text-xs uppercase transition-all ${isActive
                                ? 'bg-[#f5f1e8] text-[#1a1a2e]'
                                : 'text-[#f5f1e8]/60 hover:text-[#f5f1e8] hover:bg-white/5'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'status' && statusPanel}
                {activeTab === 'social' && socialPanel}
                {activeTab === 'content' && contentPanel}
                {activeTab === 'moderation' && moderationPanel}
                {activeTab === 'marketplace' && marketplacePanel}
                {activeTab === 'sync' && syncPanel}
            </div>
        </div>
    );
}
