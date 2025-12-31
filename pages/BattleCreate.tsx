
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameService } from '../services/gameService';
import { BoxInfo, BattleMode, BattleRule, BoxItem } from '../types';
import { useAuth } from '../App';
import { getBoxImageUrl, RULE_ICONS } from '../constants';
import { OddsModal } from '../components/OddsModal';

export const BattleCreate: React.FC = () => {
    const navigate = useNavigate();
    const { user, login, balance, refreshBalance } = useAuth();
    
    const [boxes, setBoxes] = useState<BoxInfo[]>([]);
    const [cart, setCart] = useState<BoxInfo[]>([]);
    const [mode, setMode] = useState<BattleMode>('1v1');
    const [rule, setRule] = useState<BattleRule>('classic');
    const [jackpot, setJackpot] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Odds Modal State
    const [viewingBox, setViewingBox] = useState<BoxInfo | null>(null);
    const [viewingBoxItems, setViewingBoxItems] = useState<BoxItem[]>([]);

    useEffect(() => {
        GameService.getBoxes().then(setBoxes);
    }, []);

    const addToCart = (box: BoxInfo) => setCart([...cart, box]);
    const removeFromCart = (index: number) => setCart(cart.filter((_, i) => i !== index));
    const entryCost = cart.reduce((sum, b) => sum + b.price, 0);

    const handleCreate = async () => {
        if (!user) { login(); return; }
        if (cart.length === 0) return;
        if (balance < entryCost) { alert("Insufficient funds"); return; }

        setIsLoading(true);
        try {
            const battleId = await GameService.createBattleRoom(
                cart.map(b => b.name),
                entryCost, // This is the "Battle_code" / cost_per_player
                mode,
                rule,
                jackpot,
                user.id,
                user.email
            );
            
            // Optimistically deduct balance to show immediate feedback
            // This prevents the user from seeing their old balance before the DB trigger processes
            refreshBalance(balance - entryCost);
            
            navigate(`/battle/room/${battleId}`);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenOdds = async (e: React.MouseEvent, box: BoxInfo) => {
        e.stopPropagation();
        setViewingBox(box);
        setViewingBoxItems([]);
        try {
            const items = await GameService.getBoxItems(box.box_id);
            setViewingBoxItems(items);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl flex flex-col lg:flex-row gap-8 min-h-[85vh]">
            <div className="flex-1 flex flex-col bg-[#0e1020] border border-[#2a2c45] rounded-3xl p-6 overflow-hidden">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                    <h2 className="text-sm font-black text-muted uppercase tracking-widest flex items-center gap-3">
                        <span className="w-2 h-2 bg-neon1 rounded-full animate-pulse"></span>
                        1. Select Artifacts
                    </h2>
                    <span className="text-[10px] text-gray-500 font-mono">{boxes.length} Available</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto scrollbar-hide pr-2">
                    {boxes.map(box => (
                        <div 
                            key={box.box_id} 
                            onClick={() => addToCart(box)} 
                            className="bg-black/40 border border-[#2a2c45] rounded-2xl p-4 cursor-pointer hover:border-neon1 hover:bg-[#1a1d2e] flex flex-col items-center text-center transition-all group relative"
                        >
                            <div className="absolute top-2 right-2 z-10">
                                <button 
                                    onClick={(e) => handleOpenOdds(e, box)}
                                    className="w-5 h-5 rounded-full bg-black/60 border border-white/20 text-gray-300 flex items-center justify-center text-[10px] font-serif hover:bg-neon1 hover:text-black hover:border-neon1 transition-all"
                                    title="View Odds"
                                >
                                    i
                                </button>
                            </div>

                            <div className="relative w-20 h-20 mb-3 transition-transform group-hover:scale-110">
                                <img src={getBoxImageUrl(box.image)} className="w-full h-full object-contain" alt={box.name} onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/64'} />
                            </div>
                            <div className="text-[10px] font-black text-gray-300 truncate w-full uppercase mb-1">{box.name}</div>
                            <div className="text-xs text-neon3 font-black italic">{box.price.toLocaleString()} GP</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="w-full lg:w-[420px] shrink-0">
                <div className="bg-[#0e1020] border border-[#2a2c45] rounded-3xl p-8 h-full flex flex-col shadow-2xl">
                    <h2 className="text-sm font-black text-muted uppercase tracking-widest mb-8 pb-4 border-b border-white/5">
                        2. Session Configuration
                    </h2>
                    
                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className="text-[10px] text-gray-500 font-black block mb-2 uppercase tracking-widest">Mode</label>
                            <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="w-full bg-[#1a1d2e] border border-[#2a2c45] text-white p-3 rounded-xl text-xs font-bold focus:border-neon1 outline-none">
                                <option value="1v1">1 vs 1</option>
                                <option value="1v1v1">1 vs 1 vs 1</option>
                                <option value="1v1v1v1">1 vs 1 vs 1 vs 1</option>
                                <option value="2v2">2 vs 2</option>
                                <option value="2v2v2">2 vs 2 vs 2</option>
                                <option value="3v3">3 vs 3</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-black block mb-2 uppercase tracking-widest">Rule</label>
                            <select value={rule} onChange={(e) => setRule(e.target.value as any)} className="w-full bg-[#1a1d2e] border border-[#2a2c45] text-white p-3 rounded-xl text-xs font-bold focus:border-neon1 outline-none">
                                <option value="classic">Classic</option>
                                <option value="terminal">Terminal</option>
                                <option value="less">Less</option>
                                <option value="whale">Whale</option>
                            </select>
                        </div>
                    </div>

                    <label className="flex items-center gap-4 cursor-pointer bg-black/20 p-4 rounded-2xl border border-white/5 hover:border-yellow-500/50 mb-8 group transition-all">
                        <input type="checkbox" checked={jackpot} onChange={(e) => setJackpot(e.target.checked)} className="accent-yellow-500 w-5 h-5" />
                        <div>
                            <span className="text-xs font-black text-gray-300 group-hover:text-yellow-400 uppercase tracking-widest block">Enable Jackpot</span>
                            <span className="text-[9px] text-gray-600 uppercase font-bold tracking-widest block mt-1">Outcome by Probability</span>
                        </div>
                    </label>

                    <div className="flex-1 bg-black/20 rounded-2xl border border-[#2a2c45] p-2 mb-8 overflow-y-auto max-h-[300px]">
                        {cart.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-700 space-y-3 py-10">
                                <span className="text-4xl opacity-20">📦</span>
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Cart Empty</span>
                            </div>
                        )}
                        {cart.map((box, i) => (
                            <div key={i} className="flex justify-between items-center p-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-all group rounded-xl">
                                <div className="flex items-center gap-4">
                                    <span className="text-gray-600 font-mono text-[10px]">{i+1}</span>
                                    <span className="text-xs font-black text-white uppercase tracking-wider truncate max-w-[120px]">{box.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-neon3 text-xs font-bold italic">{box.price.toLocaleString()}</span>
                                    <button onClick={() => removeFromCart(i)} className="text-gray-600 hover:text-red-500 transition-colors text-xl leading-none px-2">&times;</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-black/40 p-6 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-[10px] text-muted font-black uppercase tracking-widest">Entry Price</span>
                            <span className="text-xl font-black text-white italic">{entryCost.toLocaleString()} <span className="text-xs text-muted">GP</span></span>
                        </div>
                        <button 
                            onClick={handleCreate} 
                            disabled={cart.length === 0 || isLoading} 
                            className={`w-full py-4 font-black uppercase text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 ${cart.length === 0 || isLoading ? 'bg-[#2a2c45] text-gray-500 cursor-not-allowed' : 'bg-neon1 text-black hover:bg-white hover:scale-105 active:scale-95'}`}
                        >
                            {isLoading ? 'Processing...' : 'Initialize Battle'}
                        </button>
                    </div>
                </div>
            </div>

            {viewingBox && (
                <OddsModal 
                    box={viewingBox} 
                    items={viewingBoxItems} 
                    onClose={() => setViewingBox(null)} 
                />
            )}
        </div>
    );
};
