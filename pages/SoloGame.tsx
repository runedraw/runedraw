
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GameService } from '../services/gameService';
import { BoxInfo, SpinResult, BoxItem } from '../types';
import { useAuth } from '../App';
import { SlotReel } from '../components/SlotReel';
import { TIER_COLORS, getItemIcon, getItemImageUrl } from '../constants';
import { OddsModal } from '../components/OddsModal';

export const SoloGame: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, refreshBalance, login, balance } = useAuth();
    
    const [box, setBox] = useState<BoxInfo | null>(null);
    const [boxItems, setBoxItems] = useState<BoxItem[]>([]);
    
    // API State
    const [isLoading, setIsLoading] = useState(false);
    
    // Visual State
    const [isAnimating, setIsAnimating] = useState(false);
    const [showOdds, setShowOdds] = useState(false);
    
    // Data State
    const [results, setResults] = useState<SpinResult[]>([]); // Array for multi-spin
    const [history, setHistory] = useState<SpinResult[]>([]);
    
    // Options
    const [isGolden, setIsGolden] = useState(false);
    const [spinCount, setSpinCount] = useState(1);
    
    // Tracking completion of multiple reels
    const finishedReelsRef = useRef(0);

    useEffect(() => {
        if (!id) return;
        const boxId = Number(id);
        
        GameService.getBoxes().then(boxes => {
            const b = boxes.find(x => x.box_id === boxId); 
            if (b) setBox(b);
            else navigate('/boxes');
        });

        GameService.getBoxItems(boxId).then(items => {
            setBoxItems(items);
        });
    }, [id, navigate]);

    // Safety Watchdog
    useEffect(() => {
        let watchdog: any;
        if (isAnimating) {
            watchdog = setTimeout(() => {
                console.warn("Animation stuck watchdog triggered - forcing unlock");
                if (results.length > 0) {
                    handleAllAnimationsComplete(); 
                } else {
                    setIsAnimating(false);
                    setIsLoading(false);
                }
            }, 15000); 
        }
        return () => clearTimeout(watchdog);
    }, [isAnimating, results]);

    const activePool = React.useMemo(() => {
        if (!isGolden) return boxItems;
        const filtered = boxItems.filter(item => {
            const t = item.tier.toLowerCase();
            return !['gray', 'green', 'common', 'uncommon'].includes(t);
        });
        return filtered.map(item => ({
            ...item,
            weight: item.weight_golden ?? item.weight 
        }));
    }, [boxItems, isGolden]);

    const handleSpin = async () => {
        if (!user) {
            login();
            return;
        }
        if (!box || isLoading || isAnimating) return;

        const singleCost = isGolden 
            ? (box.price_golden !== undefined && box.price_golden > 0 ? box.price_golden : box.price * 10) 
            : box.price;
            
        const totalCost = singleCost * spinCount;

        if (balance < totalCost) {
            alert("Insufficient balance!");
            return;
        }

        setIsLoading(true);
        setIsAnimating(true);
        setResults([]); 
        finishedReelsRef.current = 0;

        refreshBalance(balance - totalCost);

        try {
            const rawResults = await GameService.spinSoloBox(box.box_id, isGolden, spinCount);
            
            if (!rawResults || rawResults.length === 0) {
                throw new Error("Spin returned no results.");
            }

            const enrichedResults: SpinResult[] = rawResults.map((rawResult: any) => {
                let rawTier = String(rawResult?.tier ?? rawResult?.Tier ?? 'gray').toLowerCase();
                if (!TIER_COLORS[rawTier]) {
                    const map: any = { common: 'gray', uncommon: 'green', rare: 'blue', epic: 'red', legendary: 'gold' };
                    rawTier = map[rawTier] || 'gray';
                }

                const payoutVal = Number(
                    rawResult?.payout ?? rawResult?.item_value ?? rawResult?.value ?? rawResult?.Payout ?? 0
                );

                const itemName = String(
                    rawResult?.item_name ?? rawResult?.ItemName ?? rawResult?.name ?? 'Mystery Item'
                );
                
                // Lookup image from loaded items
                const originalItem = boxItems.find(i => i.name === itemName);
                // Ensure image URL is prioritized
                const itemImage = originalItem?.image ? getItemImageUrl(originalItem.image) : '';

                return {
                    payout: payoutVal,
                    tier: rawTier,
                    item_name: itemName,
                    item_icon: itemImage,
                    is_golden: !!(rawResult?.is_golden ?? rawResult?.IsGolden),
                    new_balance: rawResult?.new_balance
                };
            });

            setResults(enrichedResults);
            setIsLoading(false);

        } catch (err: any) {
            console.error("Spin Error:", err);
            setIsLoading(false);
            setIsAnimating(false);
            refreshBalance();
            alert(err.message || "An error occurred.");
        }
    };

    const handleSingleReelStop = () => {
        finishedReelsRef.current += 1;
        if (finishedReelsRef.current >= spinCount) {
            handleAllAnimationsComplete();
        }
    };

    const handleAllAnimationsComplete = () => {
        if (results.length > 0 && box) {
            const singleItemCost = isGolden 
                ? (box.price_golden !== undefined && box.price_golden > 0 ? box.price_golden : box.price * 10) 
                : box.price;

            setHistory(prev => {
                const newItems = results.map(r => ({ ...r, cost: singleItemCost }));
                return [...newItems, ...prev].slice(0, 100);
            });
            
            const lastResult = results[results.length - 1];
            if (typeof lastResult.new_balance === 'number') {
                refreshBalance(lastResult.new_balance);
            } else {
                refreshBalance();
            }
        }
        setIsAnimating(false);
    };

    const handleSetSpinCount = (count: number) => {
        setSpinCount(count);
        setResults([]); 
    };

    if (!box) return <div className="p-10 text-center">Loading Box...</div>;

    const singleCost = isGolden 
        ? (box.price_golden !== undefined && box.price_golden > 0 ? box.price_golden : box.price * 10) 
        : box.price;
        
    const totalSpinCost = singleCost * spinCount;
    const isLocked = isLoading || isAnimating;
    
    const sessionCost = history.reduce((acc, curr) => acc + (curr.cost || 0), 0);
    const sessionWon = history.reduce((acc, curr) => acc + (curr.payout || 0), 0);
    const profit = sessionWon - sessionCost;
    
    const isMultiLane = spinCount > 1;

    return (
        <div className="container mx-auto p-4 max-w-[95vw] 2xl:max-w-[1800px]">
            <button 
                onClick={() => !isLocked && navigate('/boxes')} 
                className={`text-muted hover:text-white mb-4 font-bold ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isLocked}
            >
                ← Back to Boxes
            </button>
            
            <div className="flex flex-col gap-8">
                <div className="bg-[#0e1020] border border-[#2a2c45] rounded-xl p-6 mb-6 relative overflow-hidden shadow-2xl">
                    <div className="flex flex-col xl:flex-row justify-between items-center mb-6 gap-4">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-extrabold text-white uppercase tracking-widest">{box.name}</h1>
                            <button 
                                onClick={() => setShowOdds(true)}
                                className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-xs text-muted hover:text-white hover:border-white transition-colors bg-white/5"
                                title="View Odds"
                            >
                                i
                            </button>
                        </div>
                        
                        <div className="flex flex-wrap justify-center items-stretch gap-4">
                            <div className="flex items-center gap-4 bg-black/20 p-2 rounded-lg border border-white/5">
                                <label className={`flex items-center gap-2 select-none px-2 ${isLocked ? 'opacity-50' : 'cursor-pointer'}`}>
                                    <span className={`text-xs font-bold ${isGolden ? 'text-yellow-400' : 'text-muted'}`}>GOLDEN</span>
                                    <input 
                                        type="checkbox" 
                                        checked={isGolden} 
                                        onChange={(e) => setIsGolden(e.target.checked)}
                                        disabled={isLocked}
                                        className="accent-yellow-400 w-4 h-4"
                                    />
                                </label>

                                <div className="w-[1px] h-6 bg-white/10"></div>

                                <div className="flex items-center gap-1">
                                    <span className="text-xs font-bold text-muted mr-1">ROLLS:</span>
                                        {[1, 2, 3, 4].map(num => (
                                        <button
                                            key={num}
                                            onClick={() => handleSetSpinCount(num)}
                                            disabled={isLocked}
                                            className={`
                                                w-8 h-8 rounded font-bold text-sm transition-all border
                                                ${spinCount === num 
                                                    ? 'bg-neon1 text-black border-neon1 shadow-[0_0_10px_rgba(109,249,255,0.4)]' 
                                                    : 'bg-[#1a1d2e] text-gray-400 border-transparent hover:border-white/20'
                                                }
                                                disabled:opacity-50 disabled:cursor-not-allowed
                                            `}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button 
                                onClick={handleSpin}
                                disabled={isLocked}
                                className={`
                                    px-8 py-2 rounded-lg font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center min-w-[140px]
                                    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                                    ${isGolden 
                                        ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow-[0_0_15px_rgba(255,215,0,0.4)]' 
                                        : 'bg-gradient-to-r from-neon1 to-neon2 text-black shadow-[0_0_15px_rgba(109,249,255,0.4)]'
                                    }
                                    hover:scale-105 active:scale-95
                                `}
                            >
                                {isAnimating ? 'ROLLING...' : (
                                    <div className="flex flex-col leading-none text-center">
                                        <span className="text-[10px] opacity-80 mb-0.5">OPEN</span>
                                        <span>{(totalSpinCost || 0).toLocaleString()} GP</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className={`
                        mb-8 rounded-xl border border-[#2a2c45]/50 bg-black/50 transition-all 
                        ${isGolden ? 'shadow-[inset_0_0_20px_rgba(255,215,0,0.1)] border-yellow-400/30' : ''}
                        ${isMultiLane ? 'p-4 h-[500px]' : 'p-4'}
                    `}>
                        {isMultiLane ? (
                            <div className="w-full h-full flex gap-1 md:gap-4 justify-center">
                                {Array.from({ length: spinCount }).map((_, idx) => (
                                    <div key={idx} className="flex-1 min-w-0 h-full bg-[#1a1d2e]/30 rounded-lg border border-white/5 relative shadow-inner">
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0e1020] border border-[#2a2c45] text-[10px] px-2 rounded text-muted z-20 whitespace-nowrap shadow-sm">
                                            LANE {idx + 1}
                                            </div>
                                            
                                            <SlotReel 
                                            // Added key to force reset when box changes
                                            key={`${box.box_id}-${idx}`}
                                            spinning={isAnimating && !results[idx]} 
                                            result={results[idx] || null} 
                                            pool={activePool} 
                                            isVertical={true} 
                                            onStop={handleSingleReelStop} 
                                            />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <SlotReel 
                                // Added key to force reset when box changes
                                key={box.box_id}
                                spinning={isAnimating && !results[0]} 
                                result={results[0] || null} 
                                pool={activePool} 
                                isVertical={false} 
                                onStop={handleSingleReelStop} 
                            />
                        )}
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        {!isAnimating && results.length > 0 && (
                            <div className="text-center animate-fade-in mb-2 w-full">
                                <div className="text-xs text-muted uppercase tracking-widest">Total Win</div>
                                <div className={`text-4xl font-black drop-shadow-[0_0_15px_rgba(109,249,255,0.6)] ${results.some(r => r.is_golden) ? 'text-yellow-400 drop-shadow-[0_0_25px_rgba(255,215,0,0.6)]' : 'text-neon1'}`}>
                                    {results.reduce((sum, r) => sum + (r.payout || 0), 0).toLocaleString()} GP
                                </div>
                                <div className="flex flex-wrap gap-2 justify-center mt-2">
                                    {results.map((r, i) => (
                                        <div key={i} className="w-8 h-8 rounded border border-white/20 flex items-center justify-center text-sm bg-[#1a1d2e] relative group" title={r.item_name}>
                                            {(r.item_icon?.includes('/') || r.item_icon?.startsWith('data:')) ? <img src={r.item_icon} alt="" className="w-full h-full object-contain p-1 brightness-125" /> : r.item_icon}
                                            <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full" style={{ backgroundColor: TIER_COLORS[r.tier] }}></div>
                                            {r.is_golden && (
                                                <div className="absolute -top-3 -right-3 bg-yellow-400 text-black text-[8px] font-bold px-1 rounded shadow-sm scale-75">
                                                    GOLD
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {history.length > 0 && (
                            <div className="grid grid-cols-3 gap-4 w-full max-w-lg bg-black/30 border border-white/5 rounded-lg p-3">
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] text-gray-400 uppercase font-bold">Session Cost</span>
                                    <span className="text-white font-bold">{(sessionCost || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col items-center border-l border-white/10">
                                    <span className="text-[10px] text-gray-400 uppercase font-bold">Session Won</span>
                                    <span className="text-neon1 font-bold">{(sessionWon || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col items-center border-l border-white/10">
                                    <span className="text-[10px] text-gray-400 uppercase font-bold">PnL</span>
                                    <span className={`font-bold ${profit > 0 ? 'text-green-400' : profit < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                                        {profit > 0 ? '+' : ''}{(profit || 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-[#0e1020] border border-[#2a2c45] rounded-xl p-4">
                    <h3 className="text-xs font-bold text-muted uppercase mb-3">Live Session Feed</h3>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
                        {history.map((h, i) => (
                            <div key={i} className={`flex items-center justify-between bg-white/5 p-2 rounded border-l-4 animate-slide-in ${h.is_golden ? 'bg-yellow-900/10' : ''}`} style={{ borderLeftColor: TIER_COLORS[h.tier] || '#444' }}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded flex items-center justify-center text-xl shadow-inner border overflow-hidden ${h.is_golden ? 'border-yellow-500/50 bg-yellow-900/20' : 'border-white/5 bg-black/40'}`}>
                                        {(h.item_icon?.includes('/') || h.item_icon?.startsWith('data:')) ? <img src={h.item_icon} alt="" className="w-full h-full object-contain p-1 brightness-125" /> : h.item_icon}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-black/50 text-white font-bold uppercase tracking-wider border border-white/10">
                                                {h.tier}
                                            </span>
                                            {h.is_golden && <span className="text-[8px] font-bold text-yellow-400 border border-yellow-400 rounded px-1">GOLDEN</span>}
                                        </div>
                                        <span className="text-sm font-bold text-gray-200 mt-0.5">{h.item_name}</span>
                                    </div>
                                </div>
                                <span className={`text-sm font-black drop-shadow-sm ${h.is_golden ? 'text-yellow-400' : 'text-neon1'}`}>+{(h.payout || 0).toLocaleString()}</span>
                            </div>
                        ))}
                        {history.length === 0 && <div className="text-center text-xs text-gray-600 py-8 italic">Spin the box to win items!</div>}
                    </div>
                </div>
            </div>

            {showOdds && box && (
                <OddsModal 
                    box={box} 
                    items={boxItems} 
                    onClose={() => setShowOdds(false)} 
                />
            )}
        </div>
    );
};
