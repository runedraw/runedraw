
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameService } from '../services/gameService';
import { Transaction, UserData, SoloHistoryEntry } from '../types';
import { useAuth } from '../App';
import { getItemIcon, TIER_COLORS, RULE_ICONS, getItemImageUrl, normalizeItemImageName } from '../constants';

interface UserProfileModalProps {
    initialTab?: 'stats' | 'solo' | 'battle' | 'transactions';
    onClose: () => void;
}

const LEVEL_XP_STEP = 10000; 

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ initialTab = 'stats', onClose }) => {
    const { user, balance } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'stats' | 'solo' | 'battle' | 'transactions'>(initialTab);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [soloHistory, setSoloHistory] = useState<SoloHistoryEntry[]>([]);
    const [battleHistory, setBattleHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const avatarUrl = `https://api.dicebear.com/9.x/shapes/svg?seed=${user?.id}&backgroundColor=0e1020&shape1Color=6df9ff&shape2Color=ffd166&shape3Color=ff9afd`;
    const email = user?.email || 'Anonymous';
    
    const wageredXP = userData?.wagered_xp || 0;
    const level = Math.floor(wageredXP / LEVEL_XP_STEP) + 1;
    const nextLevelXP = level * LEVEL_XP_STEP;
    const progressXP = wageredXP % LEVEL_XP_STEP;
    const progressPercent = (progressXP / (LEVEL_XP_STEP || 1)) * 100;

    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const [uData, txData, sHistory, bHistory] = await Promise.all([
                    GameService.getUserData(user.id).catch(() => null),
                    GameService.getUserTransactions(user.id).catch(() => []),
                    GameService.getSoloHistory(user.id).catch(() => []),
                    GameService.getBattleHistory(user.id).catch(() => []) // Now returns grouped V2 objects
                ]);

                setUserData(uData);
                setTransactions(txData || []);
                setSoloHistory(sHistory || []);
                setBattleHistory(bHistory || []);

            } catch (e) {
                console.error("Critical error loading profile:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const formatTime = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return "Unknown Date";
            return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } catch (e) { return "Date Error"; }
    };

    const handleWatchReplay = (battleId: number) => {
        onClose();
        navigate(`/battle/replay/${battleId}`);
    };

    const handleOpenGallery = () => {
        onClose();
        navigate('/gallery');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div 
                className="relative w-full max-w-4xl bg-[#0e1020] border border-[#2a2c45] rounded-xl shadow-2xl flex flex-col h-[90vh] overflow-hidden animate-slide-in" 
                onClick={e => e.stopPropagation()}
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-3 right-3 z-[110] w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-red-500/20 transition-all focus:outline-none"
                    aria-label="Close Profile"
                >
                    ✕
                </button>

                <div className="flex flex-col md:flex-row bg-[#1a1d2e] border-b border-[#2a2c45]">
                    <div className="p-4 flex items-center gap-4 border-b md:border-b-0 md:border-r border-[#2a2c45] md:w-64 flex-shrink-0 bg-black/20 pr-12 md:pr-4">
                         <img src={avatarUrl} alt="Avatar" className="w-10 h-10 rounded-lg border border-neon1/30 bg-[#0e1020]" />
                         <div className="overflow-hidden">
                             <div className="text-xs sm:text-sm font-bold text-white truncate">{email}</div>
                             <div className="text-[10px] sm:text-xs text-muted">Lvl {level} • {(balance || 0).toLocaleString()} GP</div>
                         </div>
                    </div>

                    <div className="flex-1 flex overflow-x-auto scrollbar-hide">
                        {[
                            { id: 'stats', label: 'Stats', icon: '📊' },
                            { id: 'solo', label: 'Solo', icon: '📦' },
                            { id: 'battle', label: 'Battles', icon: '⚔️' },
                            { id: 'transactions', label: 'Logs', icon: '🧾' },
                        ].map((tab) => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`
                                    flex-1 min-w-[90px] py-4 px-2 sm:px-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2
                                    ${activeTab === tab.id 
                                        ? 'bg-[#0e1020] text-neon1 border-b-2 border-neon1' 
                                        : 'text-gray-500 hover:text-white hover:bg-white/5 border-b-2 border-transparent'}
                                `}
                            >
                                <span className="text-base sm:text-lg">{tab.icon}</span> <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-0 scrollbar-hide bg-[#0e1020]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted">
                            <div className="w-8 h-8 border-2 border-neon1 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <div className="text-[10px] font-black uppercase tracking-widest">Synthesizing Profile...</div>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'stats' && (
                                <div className="p-6 sm:p-12 max-w-2xl mx-auto space-y-8 animate-fade-in">
                                    <div className="text-center">
                                        <div className="inline-block relative mb-4">
                                            <img src={avatarUrl} alt="Avatar" className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl border-4 border-[#2a2c45] bg-[#1a1d2e] shadow-2xl" />
                                        </div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-white">{email}</h2>
                                        <div className="text-[10px] text-gray-500 font-mono mt-1 opacity-50 tracking-widest uppercase">ID: {user?.id.slice(0, 16)}</div>
                                    </div>
                                    
                                    {/* GALLERY BUTTON */}
                                    <div className="flex justify-center">
                                        <button 
                                            onClick={handleOpenGallery}
                                            className="px-8 py-3 bg-neon1/10 border border-neon1 text-neon1 font-black uppercase text-sm rounded-xl hover:bg-neon1 hover:text-black hover:scale-105 transition-all shadow-[0_0_20px_rgba(109,249,255,0.2)] flex items-center gap-2"
                                        >
                                            <span>💎</span> View Achievement Gallery
                                        </button>
                                    </div>

                                    <div className="bg-[#1a1d2e] p-6 rounded-2xl border border-[#2a2c45] shadow-lg">
                                        <div className="flex justify-between text-xs font-bold uppercase mb-3 text-muted">
                                            <span>Level Progress</span>
                                            <span className="text-neon1">{(progressPercent || 0).toFixed(1)}%</span>
                                        </div>
                                        <div className="h-4 bg-black rounded-full overflow-hidden border border-white/5 mb-3">
                                            <div className="h-full bg-gradient-to-r from-blue-600 via-neon1 to-white transition-all duration-1000 shadow-[0_0_15px_rgba(109,249,255,0.4)]" style={{ width: `${progressPercent}%` }}></div>
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                                            <span>{(wageredXP || 0).toLocaleString()} XP TOTAL</span>
                                            <span>{(nextLevelXP || 0).toLocaleString()} XP GOAL</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-black/30 p-5 rounded-2xl border border-[#2a2c45] text-center">
                                            <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Total Wagered</div>
                                            <div className="text-2xl font-black text-neon3">{(wageredXP || 0).toLocaleString()}</div>
                                        </div>
                                        <div className="bg-black/30 p-5 rounded-2xl border border-[#2a2c45] text-center">
                                            <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Current Credits</div>
                                            <div className="text-2xl font-black text-white">{(balance || 0).toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'solo' && (
                                <div className="min-w-full inline-block align-middle animate-fade-in">
                                    <div className="sticky top-0 bg-[#1a1d2e] z-10 border-b border-[#2a2c45] grid grid-cols-12 gap-2 px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                        <div className="col-span-6 md:col-span-4">Item Acquired</div>
                                        <div className="col-span-3 md:col-span-3">Source Box</div>
                                        <div className="col-span-3 md:col-span-2 text-right">Value</div>
                                        <div className="hidden md:block col-span-3 text-right">Time</div>
                                    </div>
                                    
                                    <div className="divide-y divide-white/5">
                                        {soloHistory.map(entry => {
                                            const tierColor = TIER_COLORS[entry.tier] || '#666';
                                            return (
                                                <div key={entry.id} className="grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-white/5 transition-colors">
                                                    <div className="col-span-6 md:col-span-4 flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded bg-[#1a1d2e] border flex items-center justify-center text-xl shadow-inner flex-shrink-0 overflow-hidden" style={{ borderColor: tierColor }}>
                                                            <img 
                                                                src={getItemImageUrl(normalizeItemImageName(entry.item_name))} 
                                                                alt={entry.item_name}
                                                                className="w-full h-full object-contain p-1"
                                                                onError={(e) => { 
                                                                    e.currentTarget.style.display = 'none';
                                                                    if (e.currentTarget.parentElement) e.currentTarget.parentElement.innerText = '📦';
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-bold text-white truncate" style={{ color: tierColor }}>{entry.item_name}</div>
                                                            <div className="text-[10px] text-gray-600 uppercase font-bold">{entry.tier || 'common'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-3 md:col-span-3">
                                                        <div className="text-xs font-bold text-gray-400 truncate">{entry.box_name}</div>
                                                    </div>
                                                    <div className="col-span-3 md:col-span-2 text-right font-bold text-neon1 text-sm">
                                                        {(entry.item_value || 0).toLocaleString()}
                                                    </div>
                                                    <div className="hidden md:block col-span-3 text-right text-[10px] text-gray-500 font-mono">
                                                        {formatTime(entry.created_at)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {soloHistory.length === 0 && <div className="p-16 text-center text-gray-600 italic text-sm">No solo matches recorded.</div>}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'battle' && (
                                <div className="min-w-full inline-block align-middle animate-fade-in">
                                    <div className="sticky top-0 bg-[#1a1d2e] z-10 border-b border-[#2a2c45] grid grid-cols-12 gap-2 px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                        <div className="col-span-4 flex gap-4">
                                            <div className="w-10">Icon</div>
                                            <div>Mode / Rule</div>
                                        </div>
                                        <div className="col-span-2 text-center">Status</div>
                                        <div className="col-span-3 text-center">Outcome</div>
                                        <div className="col-span-3 text-right">Action</div>
                                    </div>

                                    <div className="divide-y divide-white/5">
                                        {battleHistory.map(battle => {
                                            const bId = battle.battle_id;
                                            const winAmount = Number(battle.total_payout || 0);
                                            const isWin = battle.is_winner;
                                            
                                            return (
                                                <div key={bId} className="grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-white/5 transition-colors group">
                                                    <div className="col-span-4 flex items-center gap-4 min-w-0">
                                                        <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center text-xl shrink-0 group-hover:bg-neon1/10 transition-colors">
                                                            {RULE_ICONS[battle.rule?.toLowerCase()] || '⚔️'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-black text-white uppercase truncate mb-0.5">{battle.mode || 'PvP'}</div>
                                                            <div className="text-[9px] font-bold text-muted uppercase tracking-widest">{battle.rule || 'Classic'}</div>
                                                        </div>
                                                    </div>

                                                    <div className="col-span-2 flex justify-center">
                                                        <div className={`text-[10px] font-black px-3 py-1 rounded-full border ${isWin ? 'text-neon1 border-neon1/20 bg-neon1/5' : 'text-red-500 border-red-500/20 bg-red-500/5'}`}>
                                                            {isWin ? 'VICTORY' : 'DEFEAT'}
                                                        </div>
                                                    </div>

                                                    <div className="col-span-3 text-center">
                                                        <div className="text-[11px] font-black text-white italic">
                                                            {winAmount > 0 ? `+${winAmount.toLocaleString()}` : (battle.total_pot ? `-${(battle.total_pot / (GameService.getPlayerCountFromMode(battle.mode as any))).toLocaleString()}` : '0')}
                                                            <span className="text-[9px] text-muted ml-1 uppercase">GP</span>
                                                        </div>
                                                    </div>

                                                    <div className="col-span-3 text-right">
                                                        <button 
                                                            onClick={() => handleWatchReplay(bId)}
                                                            className="px-4 py-2 bg-white/5 border border-white/10 hover:border-neon1 text-white text-[10px] font-black uppercase rounded shadow-md hover:bg-neon1 hover:text-black transition-all ml-auto"
                                                        >
                                                            REPLAY ▶
                                                        </button>
                                                        <div className="text-[8px] text-gray-600 font-mono mt-1 uppercase">
                                                            {formatTime(battle.completed_at || battle.created_at)}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        
                                        {battleHistory.length === 0 && (
                                            <div className="p-16 text-center text-gray-600 italic text-sm font-bold uppercase tracking-widest opacity-30">
                                                No Match Records Found
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'transactions' && (
                                <div className="min-w-full inline-block align-middle animate-fade-in">
                                     <div className="sticky top-0 bg-[#1a1d2e] z-10 border-b border-[#2a2c45] grid grid-cols-3 gap-2 px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                        <div>Description</div>
                                        <div className="text-right">Amount</div>
                                        <div className="text-right">Balance</div>
                                    </div>
                                    <div className="divide-y divide-white/5">
                                        {transactions.map(tx => {
                                            const isPositive = (tx.amount || 0) > 0;
                                            return (
                                                <div key={tx.id} className="grid grid-cols-3 gap-2 px-6 py-4 items-center hover:bg-white/5 transition-colors">
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold text-white uppercase truncate">{ (tx.source || 'Unknown').replace(/_/g, ' ') }</div>
                                                        <div className="text-[9px] text-gray-600 font-mono">{formatTime(tx.created_at)}</div>
                                                    </div>
                                                    <div className={`text-right font-mono font-bold text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                                        {isPositive ? '+' : ''}{(tx.amount || 0).toLocaleString()}
                                                    </div>
                                                    <div className="text-right text-xs text-gray-400 font-mono">
                                                        {(tx.balance || 0).toLocaleString()}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {transactions.length === 0 && <div className="p-16 text-center text-gray-600 italic text-sm">No recorded transactions.</div>}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
