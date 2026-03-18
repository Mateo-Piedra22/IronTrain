'use client';

import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'danger'
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const getVariantStyles = () => {
        switch (variant) {
            case 'danger':
                return 'bg-red-500 text-white hover:bg-red-600';
            case 'warning':
                return 'bg-yellow-500 text-black hover:bg-yellow-600';
            default:
                return 'bg-[#f5f1e8] text-black hover:bg-[#e5e1d8]';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-[#1a1a2e] border-2 border-[#f5f1e8] shadow-[8px_8px_0px_0px_rgba(245,241,232,0.2)] overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b-2 border-[#f5f1e8]/20 bg-[#f5f1e8]/5">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-5 h-5 ${variant === 'danger' ? 'text-red-500' : 'text-yellow-500'}`} />
                        <h3 className="text-lg font-bold text-[#f5f1e8] uppercase tracking-wider">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-[#f5f1e8]/10 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-[#f5f1e8]/50" />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-[#f5f1e8]/80 leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 bg-[#f5f1e8]/5 border-t-2 border-[#f5f1e8]/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-[#f5f1e8]/60 hover:text-[#f5f1e8] transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-6 py-2 text-sm font-bold uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${getVariantStyles()}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
            <div className="fixed inset-0 -z-10" onClick={onClose} />
        </div>
    );
}
