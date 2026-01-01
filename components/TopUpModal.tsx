
import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { GameService } from '../services/gameService';
import { CoinPackage } from '../types';

interface TopUpModalProps {
    onClose: () => void;
}

export const TopUpModal: React.FC<TopUpModalProps> = ({ onClose }) => {
    const { user, refreshBalance } = useAuth();
    const [activeTab, setActiveTab] = useState<'daily' | 'buy'>('daily');
    const [loading, setLoading] = useState(false);
    
    // Daily State
    const [dailyStatus, setDailyStatus] = useState<{ ready: boolean, remainingMs: number } | null>(null);
    const [dailyTimerStr, setDailyTimerStr] = useState("00:00:00");

    // Packages
    const packages: CoinPackage[] = [
        { id: 'starter', priceUsd: 1, coins: 50000, label: 'Starter Cache' },
        { id: 'runner', priceUsd: 2, coins: 120000, label: 'Runner Stash' },
        { id: 'operative', priceUsd: 5, coins: 360000, label: 'Operative Fund' },
        { id: 'executive', priceUsd: 10, coins: 870000, label: 'Executive Grant' },
        { id: 'whale', priceUsd: 25, coins: 2600000, label: 'Whale Vault' },
    ];

    useEffect(() => {
        if (user) {
            checkDaily();
        }
    }, [user]);

    // Timer Logic
    useEffect(() => {
        if (!dailyStatus || dailyStatus.ready) return;
        const interval = setInterval(() => {
            const now = Date.now();
            checkDaily(); 
        }, 60000); 
        
        const timer = setInterval(() => {
            setDailyStatus(prev => {
                if (!prev) return null;
                const nextMs = prev.remainingMs - 1000;
                if (nextMs <= 0) return { ready: true, remainingMs: 0 };
                return { ...prev, remainingMs: nextMs };
            });
        }, 1000);

        return () => { clearInterval(interval); clearInterval(timer); };
    }, [dailyStatus?.ready]);

    useEffect(() => {
        if (dailyStatus?.remainingMs) {
            const seconds = Math.floor((dailyStatus.remainingMs / 1000) % 60);
            const minutes = Math.floor((dailyStatus.remainingMs / (1000 * 60)) % 60);
            const hours = Math.floor((dailyStatus.remainingMs / (1000 * 60 * 60)));
            setDailyTimerStr(`${hours}h ${minutes}m ${seconds}s`);
        }
    }, [dailyStatus]);

    const checkDaily = async () => {
        if (!user) return;
        try {
            const status = await GameService.getDailyCoinStatus(user.id);
            setDailyStatus(status);
        } catch (e) { console.error(e); }
    };

    const handleClaimDaily = async () => {
        if (!user || !dailyStatus?.ready) return;
        setLoading(true);
        try {
            // Using secure RPC call
            const newBal = await GameService.claimDailyCoins(user.id);
            refreshBalance(newBal);
            checkDaily(); // Re-fetch status from server to ensure cooldown matches
            alert("Daily stipend of 10,000 GP credited.");
        } catch (e: any) {
            alert(e.message);
            // Even on error, re-check status to prevent visual desync
            checkDaily();
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async (pkg: CoinPackage) => {
        if (!user) return;
        
        setLoading(true);
        try {
            // Call Edge Function to get Stripe Checkout URL
            const url = await GameService.initiateStripeCheckout(user.id, pkg.id);
            
            // Redirect to Stripe
            window.location.href = url;
            
        } catch (e: any) {
            console.error("Purchase failed", e);
            alert("Payment initiation failed: " + e.message);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div 
                className="relative w-full max-w-2xl bg-[#0e1020] border border-[#2a2c45] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh] animate-slide-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-[#2a2c45] bg-[#1a1d2e] flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Recharge Terminal</h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Secure Credit Transfer</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex bg-[#0e1020] border-b border-[#2a2c45]">
                    <button 
                        onClick={() => setActiveTab('daily')}
                        className={`flex-1 py-4 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all ${activeTab === 'daily' ? 'text-neon1 border-b-2 border-neon1 bg-neon1/5' : 'text-gray-500'}`}
                    >
                        Daily Stipend
                    </button>
                    <button 
                        onClick={() => setActiveTab('buy')}
                        className={`flex-1 py-4 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all ${activeTab === 'buy' ? 'text-green-400 border-b-2 border-green-400 bg-green-500/5' : 'text-gray-500'}`}
                    >
                        Credit Bundles
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    {activeTab === 'daily' && (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-24 h-24 bg-neon1/10 rounded-full border-2 border-neon1 flex items-center justify-center text-4xl mb-6 shadow-[0_0_30px_rgba(109,249,255,0.3)] animate-pulse-glow">
                                💎
                            </div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2">Daily Allowance</h3>
                            <p className="text-gray-400 text-sm mb-8">Claim your free credits to continue operations.</p>
                            
                            {dailyStatus?.ready ? (
                                <button 
                                    onClick={handleClaimDaily}
                                    disabled={loading}
                                    className="px-10 py-4 bg-neon1 text-black font-black uppercase rounded-xl hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-lg text-sm"
                                >
                                    {loading ? 'Processing...' : 'Claim 10,000 GP'}
                                </button>
                            ) : (
                                <div className="px-10 py-4 bg-[#1a1d2e] border border-[#2a2c45] rounded-xl flex flex-col items-center min-w-[200px]">
                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Refills In</span>
                                    <span className="text-xl font-mono font-bold text-gray-300">{dailyTimerStr}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'buy' && (
                        <div className="space-y-3">
                            {packages.map((pkg) => (
                                <div key={pkg.id} className="flex items-center justify-between bg-[#1a1d2e] border border-[#2a2c45] p-4 rounded-xl hover:border-green-500/50 transition-all group cursor-pointer" onClick={() => handlePurchase(pkg)}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-black/40 rounded-lg flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                            💰
                                        </div>
                                        <div>
                                            <div className="text-sm font-black text-white uppercase italic tracking-wider group-hover:text-green-400 transition-colors">{pkg.label}</div>
                                            <div className="text-xs font-bold text-green-400">{pkg.coins.toLocaleString()} GP</div>
                                        </div>
                                    </div>
                                    <button 
                                        disabled={loading}
                                        className="px-6 py-2 bg-white/5 border border-white/10 text-white font-bold uppercase text-xs rounded-lg group-hover:bg-green-500 group-hover:text-black transition-all disabled:opacity-50"
                                    >
                                        ${pkg.priceUsd}
                                    </button>
                                </div>
                            ))}
                            <div className="text-center mt-6">
                                <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Secure Payments via Stripe</p>
                                <p className="text-[8px] text-gray-700">Funds added automatically upon confirmation.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
