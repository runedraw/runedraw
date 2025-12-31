
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../App';
import { GameService } from '../services/gameService';
import { BoxInfo, RewardsState, RewardTierConfig, BoxItem, SpinResult } from '../types';
import { getBoxImageUrl, getItemIcon, getItemImageUrl, TIER_COLORS } from '../constants';
import { SlotReel } from '../components/SlotReel';

export const Rewards: React.FC = () => {
    const { user, login, refreshBalance } = useAuth();
    
    // Data State
    const [rewardState, setRewardState] = useState<RewardsState | null>(null);
    const [boxes, setBoxes] = useState<BoxInfo[]>([]);
    
    // Spin Animation State
    const [spinModalOpen, setSpinModalOpen] = useState(false);
    const [spinningBox, setSpinningBox] = useState<BoxInfo | null>(null);
    const [spinningItems, setSpinningItems] = useState<BoxItem[]>([]);
    const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
    const [isSpinning, setIsSpinning] = useState(false);
    const [spinPhase, setSpinPhase] = useState<'idle' | 'spinning' | 'won'>('idle');

    const fetchData = async () => {
        try {
            // Always fetch boxes (even for guests)
            const b = await GameService.getBoxes();
            setBoxes(b);

            // Only fetch user state if logged in
            if (user) {
                const r = await GameService.getRewardsState();
                setRewardState(r);
            }
        } catch (e) {
            console.error("Failed to load rewards", e);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [user]);

    // --- DYNAMIC TIERS GENERATION ---
    const rewardTiers: RewardTierConfig[] = useMemo(() => {
        if (!boxes.length) return [];
        const sorted = [...boxes].sort((a, b) => a.price - b.price);
        
        return sorted.map((box, index) => ({
            level: index + 1,
            required_xp: box.price * 100,
            box_id: box.box_id,
            cooldown_hours: 24
        }));
    }, [boxes]);

    // --- SPIN LOGIC ---
    const initiateClaim = async (box: BoxInfo) => {
        if (!user) {
            login();
            return;
        }

        try {
            // 1. Setup UI
            setSpinningBox(box);
            setSpinModalOpen(true);
            setSpinPhase('idle');
            setSpinResult(null);
            
            // 2. Fetch Items for the visual reel
            const items = await GameService.getBoxItems(box.box_id);
            setSpinningItems(items);

            // 3. Start Visual Spin
            setIsSpinning(true);
            setSpinPhase('spinning');

            // 4. Perform Claim API Call
            // Add a small artificial delay so the user sees the spin start
            await new Promise(r => setTimeout(r, 1000));
            const result = await GameService.claimDailyReward(box.box_id);
            
            // Enrich result with correct image URL from the loaded items or fallback
            const visualItem = items.find(i => i.name === result.item_name);
            const iconUrl = visualItem?.image 
                ? getItemImageUrl(visualItem.image) 
                : getItemIcon(result.item_name);

            const enrichedResult: SpinResult = {
                ...result,
                item_icon: iconUrl
            };
            
            // 5. Trigger Stop
            setSpinResult(enrichedResult);
            // Balance will be updated after animation finishes

        } catch (e: any) {
            alert(e.message || "Failed to claim reward.");
            setSpinModalOpen(false);
            setIsSpinning(false);
        }
    };

    const handleReelStop = async () => {
        setIsSpinning(false);
        setSpinPhase('won');
        
        if (spinResult?.new_balance) {
            await refreshBalance(spinResult.new_balance);
        }
        await fetchData();
    };

    const closeSpinModal = () => {
        setSpinModalOpen(false);
        setSpinResult(null);
        setSpinningBox(null);
        setSpinPhase('idle');
    };

    // Calculate Cooldown Helper
    const getCooldownRemaining = (boxName: string) => {
        if (!user || !rewardState) return 0;
        const status = rewardState.statuses.find(s => s.box_name === boxName);
        if (!status || !status.last_claimed_at) return 0;

        const lastClaim = new Date(status.last_claimed_at).getTime();
        const now = Date.now();
        const cooldownMs = 24 * 60 * 60 * 1000; 
        const diff = (lastClaim + cooldownMs) - now;
        return diff > 0 ? diff : 0;
    };

    const Countdown = ({ ms }: { ms: number }) => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return <span className="font-mono text-neon3 font-bold">{hours}h {minutes}m</span>;
    };

    const currentXP = rewardState?.total_xp || 0;
    const maxXP = rewardTiers.length > 0 ? rewardTiers[rewardTiers.length - 1].required_xp : 100000;
    const progressPercent = user ? Math.min(100, (currentXP / (maxXP || 1)) * 100) : 0;

    return (
        <div className="container mx-auto p-4 max-w-6xl pb-20">
            
            {/* --- HEADER SECTION --- */}
            <div className="bg-[#0e1020] border border-[#2a2c45] rounded-xl p-8 mb-10 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <span className="text-9xl font-black text-white">XP</span>
                </div>

                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-4 gap-4">
                        <div>
                            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">Battle Pass</h1>
                            <p className="text-muted text-sm font-bold mt-1">Unlock Lobby Boxes as Daily Rewards. Wager 100x value to unlock.</p>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-muted uppercase font-bold tracking-widest">Total Wagered</div>
                            {user ? (
                                <div className="text-4xl font-black text-neon1 drop-shadow-md">{currentXP.toLocaleString()} <span className="text-lg">XP</span></div>
                            ) : (
                                <button onClick={login} className="text-xl font-bold text-white hover:text-neon1 underline decoration-dashed underline-offset-4">
                                    Login to track XP
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="h-6 bg-black rounded-full border border-white/10 relative mt-4">
                        <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 via-neon1 to-white rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(109,249,255,0.4)]"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                        
                        {/* Milestones */}
                        {rewardTiers.filter((_, i) => i % Math.ceil(rewardTiers.length / 5) === 0 || i === rewardTiers.length - 1).map((tier) => {
                             const pos = (tier.required_xp / maxXP) * 100;
                             const isReached = currentXP >= tier.required_xp;
                             return (
                                <div 
                                    key={tier.level} 
                                    className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 transition-all z-20 flex items-center justify-center
                                        ${isReached ? 'bg-neon1 border-white scale-125 shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'bg-[#0e1020] border-gray-600'}
                                    `}
                                    style={{ left: `${pos}%`, transform: 'translate(-50%, -50%)' }}
                                    title={`${tier.required_xp.toLocaleString()} XP`}
                                >
                                    {isReached && <div className="w-1.5 h-1.5 bg-black rounded-full"></div>}
                                </div>
                             );
                        })}
                    </div>
                    
                    <div className="flex justify-between mt-2 text-xs font-bold text-gray-500 uppercase">
                        <span>Rank 1</span>
                        <span>Max Rank ({maxXP.toLocaleString()} XP)</span>
                    </div>
                </div>
            </div>

            {/* --- REWARDS GRID --- */}
            <h2 className="text-xl font-bold text-white uppercase tracking-widest mb-6 border-l-4 border-neon1 pl-3">Daily Box Rewards</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {rewardTiers.map((tier) => {
                    const box = boxes.find(b => b.box_id === tier.box_id);
                    if (!box) return null;

                    const isUnlocked = user ? currentXP >= tier.required_xp : false;
                    const cooldownRemaining = getCooldownRemaining(box.name);
                    const isReady = isUnlocked && cooldownRemaining === 0;

                    return (
                        <div 
                            key={tier.level} 
                            className={`
                                relative bg-[#0e1020] border rounded-xl p-5 flex flex-col items-center text-center transition-all duration-300
                                ${isUnlocked ? 'border-neon1/30 shadow-[0_0_30px_rgba(0,0,0,0.3)]' : 'border-[#2a2c45]'}
                                ${!user ? 'opacity-90' : (!isUnlocked ? 'opacity-60 grayscale' : '')}
                            `}
                        >
                            {/* Level Badge */}
                            <div className="absolute top-3 left-3 bg-black/50 border border-white/10 px-2 py-0.5 rounded text-[10px] font-bold text-gray-300">
                                LVL {tier.level}
                            </div>
                            <div className="absolute top-3 right-3 bg-black/50 border border-white/10 px-2 py-0.5 rounded text-[10px] font-bold text-neon3">
                                {tier.required_xp.toLocaleString()} XP
                            </div>

                            {/* Image */}
                            <div className="relative mb-4 mt-8 group w-full flex justify-center">
                                <img 
                                    src={getBoxImageUrl(box.image)} 
                                    className={`w-32 h-32 object-contain transition-transform duration-500 brightness-110 ${isReady ? 'group-hover:scale-110 drop-shadow-[0_0_15px_rgba(109,249,255,0.3)]' : ''}`}
                                    alt={box.name}
                                />
                                {!isUnlocked && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg backdrop-blur-[2px]">
                                        <span className="text-4xl">🔒</span>
                                    </div>
                                )}
                            </div>

                            <div className="w-full mb-4">
                                <h3 className={`font-black uppercase text-sm ${isUnlocked ? 'text-white' : 'text-gray-500'}`}>{box.name}</h3>
                                <p className="text-[10px] text-muted font-bold tracking-wider">Daily Free Spin</p>
                            </div>

                            {/* Action Button */}
                            <div className="w-full mt-auto">
                                {!user ? (
                                    <button 
                                        onClick={login}
                                        className="w-full py-2 bg-white/10 border border-white/20 text-white font-bold text-xs uppercase rounded hover:bg-white hover:text-black transition-all"
                                    >
                                        Login to Claim
                                    </button>
                                ) : !isUnlocked ? (
                                    <div className="w-full py-2 bg-black/40 border border-white/5 rounded text-xs font-bold text-gray-500">
                                        {(tier.required_xp - currentXP).toLocaleString()} XP Needed
                                    </div>
                                ) : cooldownRemaining > 0 ? (
                                    <div className="w-full py-2 bg-black/40 border border-white/5 rounded flex flex-col items-center justify-center">
                                        <span className="text-[9px] text-gray-500 font-bold uppercase mb-0.5">Refills In</span>
                                        <Countdown ms={cooldownRemaining} />
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => initiateClaim(box)}
                                        className="w-full py-3 bg-neon1 text-black font-extrabold text-xs uppercase rounded hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(109,249,255,0.4)]"
                                    >
                                        CLAIM REWARD
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* --- HISTORY SECTION --- */}
            {user && rewardState && rewardState.history.length > 0 && (
                <div className="bg-[#0e1020] border border-[#2a2c45] rounded-xl p-6 animate-fade-in">
                    <h2 className="text-sm font-bold text-muted uppercase mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-neon1"></span> Recent Claims
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] text-gray-500 uppercase border-b border-white/5">
                                    <th className="p-3">Time</th>
                                    <th className="p-3">Box</th>
                                    <th className="p-3">Item</th>
                                    <th className="p-3 text-right">Value</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {rewardState.history.map((entry) => (
                                    <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-3 text-gray-400 text-xs">
                                            {new Date(entry.claimed_at).toLocaleDateString()} <span className="opacity-50">{new Date(entry.claimed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </td>
                                        <td className="p-3 font-bold text-white">{entry.box_name}</td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">
                                                    {/* We can't easily get the image here without looking up, so keeping text icon for simple table history */}
                                                    {getItemIcon(entry.item_name).startsWith('http') ? '📦' : getItemIcon(entry.item_name)}
                                                </span>
                                                <span className="text-gray-200">{entry.item_name}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right font-mono text-neon1 font-bold">
                                            +{entry.payout_value.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            {/* --- REWARD SPIN MODAL --- */}
            {spinModalOpen && spinningBox && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
                    <div className="relative w-full max-w-lg bg-[#0e1020] border-2 border-neon1 rounded-xl shadow-[0_0_50px_rgba(109,249,255,0.2)] overflow-hidden flex flex-col items-center p-6">
                        
                        {/* Header */}
                        <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-1 text-center animate-pulse">
                            {spinPhase === 'won' ? 'REWARD UNLOCKED!' : 'OPENING REWARD...'}
                        </h2>
                        <div className="text-neon1 font-bold text-sm mb-6 uppercase">{spinningBox.name}</div>

                        {/* Visual Reel */}
                        <div className="w-full h-[140px] bg-black/50 border border-[#2a2c45] rounded-lg mb-6 relative">
                            {spinningItems.length > 0 ? (
                                <SlotReel 
                                    // Added key to force reset
                                    key={spinningBox.box_id}
                                    spinning={isSpinning && !spinResult} 
                                    result={spinResult} 
                                    pool={spinningItems}
                                    onStop={handleReelStop}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted text-xs">Loading items...</div>
                            )}
                        </div>

                        {/* Result Display */}
                        {spinPhase === 'won' && spinResult && (
                            <div className="flex flex-col items-center animate-slide-in w-full">
                                <div className="w-24 h-24 mb-4 relative flex items-center justify-center bg-[#1a1d2e] rounded-xl border-2" style={{ borderColor: TIER_COLORS[spinResult.tier] || '#fff' }}>
                                    {spinResult.item_icon ? (
                                        <img src={spinResult.item_icon} alt={spinResult.item_name} className="w-full h-full object-contain p-2" />
                                    ) : (
                                        <div className="text-5xl drop-shadow-xl">🎁</div>
                                    )}
                                    <div className="absolute -bottom-3 px-3 py-1 bg-black border border-white/20 rounded-full text-[10px] font-bold uppercase text-white tracking-widest">
                                        {spinResult.tier}
                                    </div>
                                </div>
                                
                                <h3 className="text-xl font-bold text-white mb-1">{spinResult.item_name}</h3>
                                <div className="text-3xl font-black text-neon1 drop-shadow-[0_0_10px_rgba(109,249,255,0.5)] mb-6">
                                    +{spinResult.payout.toLocaleString()} GP
                                </div>

                                <button 
                                    onClick={closeSpinModal}
                                    className="px-8 py-3 bg-white text-black font-extrabold uppercase rounded hover:scale-105 transition-transform"
                                >
                                    Collect
                                </button>
                            </div>
                        )}

                        {/* Loading State */}
                        {spinPhase === 'spinning' && (
                             <div className="text-xs text-muted font-mono animate-pulse mt-4">decrypting reward data...</div>
                        )}

                    </div>
                </div>
            )}

        </div>
    );
};
