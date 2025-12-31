
import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    isDestructive?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
    isOpen, 
    title, 
    message, 
    onConfirm, 
    onCancel, 
    confirmLabel = "Confirm", 
    cancelLabel = "Cancel",
    isLoading = false,
    isDestructive = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
            <div 
                className="bg-[#0e1020] border border-[#2a2c45] rounded-2xl p-6 max-w-sm w-full shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-slide-in relative overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Decorative background flare */}
                {isDestructive && (
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>
                )}

                <h3 className={`text-xl font-black uppercase mb-3 ${isDestructive ? 'text-red-500' : 'text-white'}`}>
                    {title}
                </h3>
                
                <p className="text-gray-300 text-sm mb-8 leading-relaxed font-medium">
                    {message}
                </p>
                
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={onCancel} 
                        disabled={isLoading} 
                        className="px-4 py-3 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button 
                        onClick={onConfirm} 
                        disabled={isLoading} 
                        className={`
                            px-6 py-3 font-black text-xs uppercase rounded-xl transition-all shadow-lg flex items-center gap-2
                            ${isDestructive 
                                ? 'bg-red-500 hover:bg-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]' 
                                : 'bg-neon1 hover:bg-white text-black shadow-[0_0_20px_rgba(109,249,255,0.3)]'
                            }
                            ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                        `}
                    >
                        {isLoading && <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                        {isLoading ? 'Processing...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
