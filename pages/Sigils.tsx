
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { GameService } from '../services/gameService';
import { playGemSound, playMineClick, playWinSound } from '../constants';

export const Sigils: React.FC = () => {
    const navigate = useNavigate();
    const { user, login, balance, refreshBalance } = useAuth();

    // Game State
    const [wager, setWager] = useState<string>('100');
    const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
    const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    
    const [risk, setRisk] = useState<'classic' | 'high'>('classic');

    // 40 Runes Total
    const TOTAL_NUMBERS = 40;
    const DRAW_COUNT = 10;

    // Toggle Selection
    const toggleNumber = (num: number) => {
        if (isPlaying) return;
        
        playMineClick();

        if (selectedNumbers.includes(num)) {
            setSelectedNumbers(prev => prev.filter(n => n !== num));
        } else {
            if (selectedNumbers.length >= 10) return; // Max 10
            setSelectedNumbers(prev => [...prev, num]);
        }
    };

    // Calculate Payouts (Approx 95% RTP)
    const getPayoutTable = (pickCount: number, riskLevel: 'classic' | 'high') => {
        if (pickCount === 0) return {};
        
        const tables: any = {
            1: { 1: 3.8 },
            2: { 2: 13 },
            3: { 2: 2.5, 3: 35 },
            4: { 2: 1.5, 3: 5, 4: 80 },
            5: { 3: 2, 4: 12, 5: 300 },
            6: { 3: 1.5, 4: 5, 5: 50, 6: 800 },
            7: { 3: 1.2, 4: 3, 5: 15, 6: 100, 7: 1500 },
            8: { 4: 2, 5: 8, 6: 50, 7: 300, 8: 2000 },
            9: { 4: 1.5, 5: 4, 6: 20, 7: 100, 8: 500, 9: 3000 },
            10: { 5: 2, 6: 10, 7: 50, 8: 200, 9: 1000, 10: 5000 }
        };
        return tables[pickCount] || {};
    };

    const payoutTable = useMemo(() => getPayoutTable(selectedNumbers.length, risk), [selectedNumbers.length, risk]);
    
    // Derived Stats
    const matches = selectedNumbers.filter(n => drawnNumbers.includes(n));
    const currentMultiplier = payoutTable[matches.length] || 0;
    const winAmount = Math.floor(parseInt(wager) * currentMultiplier);

    const play = async () => {
        if (!user) { login(); return; }
        const amount = parseInt(wager);
        if (isNaN(amount) || amount <= 0 || amount > balance) return;
        if (selectedNumbers.length === 0) return;

        setIsPlaying(true);
        setDrawnNumbers([]);
        
        // Optimistic Deduct
        refreshBalance(balance - amount);

        try {
            await GameService.arcadeDeduct(user.id, 'sigils', amount);

            // RNG
            const draw = new Set<number>();
            while(draw.size < DRAW_COUNT) {
                draw.add(Math.floor(Math.random() * TOTAL_NUMBERS) + 1);
            }
            const finalDraw = Array.from(draw);
            
            // Animation
            let shownCount = 0;
            const revealInterval = setInterval(async () => {
                shownCount++;
                setDrawnNumbers(finalDraw.slice(0, shownCount));
                
                // Play sound if hit
                if (selectedNumbers.includes(finalDraw[shownCount-1])) {
                    playGemSound();
                } else {
                    playMineClick();
                }

                if (shownCount >= DRAW_COUNT) {
                    clearInterval(revealInterval);
                    setIsPlaying(false);
                    
                    // Final Calculation
                    const hitCount = selectedNumbers.filter(n => finalDraw.includes(n)).length;
                    const mult = payoutTable[hitCount] || 0;
                    const payout = Math.floor(amount * mult);

                    if (payout > 0) {
                        playWinSound();
                        await GameService.arcadePayout(user.id, 'sigils', payout);
                        // Update balance visually (Deducted + Payout)
                        // balance is already deducted in React state context
                        // But need to fetch fresh to be safe or calc
                        refreshBalance(balance - amount + payout);
                    }
                }
            }, 200);

        } catch (e: any) {
            alert(e.message);
            setIsPlaying(false);
            refreshBalance();
        }
    };

    return (
        <div className="container mx-auto p-4 max-w-6xl min-h-[85vh] flex flex-col items-center">
            <button onClick={() => navigate('/games')} className="self-start text-xs font-bold text-muted hover:text-white uppercase tracking-widest mb-8">← Back</button>

            <div className="flex flex-col lg:flex-row gap-8 w-full">
                
                {/* LEFT: BOARD */}
                <div className="flex-1 bg-[#0e1020] border border-[#2a2c45] p-6 rounded-3xl relative shadow-2xl">
                    {/* Rune Grid */}
                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 sm:gap-3">
                        {Array.from({ length: TOTAL_NUMBERS }).map((_, i) => {
                            const num = i + 1;
                            const isSelected = selectedNumbers.includes(num);
                            const isHit = drawnNumbers.includes(num);
                            const isMatch = isSelected && isHit;
                            
                            return (
                                <button
                                    key={num}
                                    onClick={() => toggleNumber(num)}
                                    disabled={isPlaying}
                                    className={`
                                        aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all relative overflow-hidden group
                                        ${isMatch 
                                            ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-[0_0_15px_rgba(250,204,21,0.6)] scale-105 z-10 border-none' 
                                            : isHit 
                                                ? 'bg-[#2a2c45] text-red-400 border border-red-500/30' 
                                                : isSelected 
                                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500 shadow-[inset_0_0_15px_rgba(34,211,238,0.2)]'
                                                    : 'bg-[#1a1d2e] text-gray-600 border border-transparent hover:bg-white/5 hover:border-white/10'
                                        }
                                    `}
                                >
                                    <span className={`absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none text-2xl font-serif ${isMatch ? 'text-black' : ''}`}>
                                        {String.fromCharCode(9800 + (num % 12))}
                                    </span>
                                    <span className="relative z-10">{num}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT: CONTROLS & PAYOUT */}
                <div className="w-full lg:w-80 flex flex-col gap-4">
                    
                    {/* Payout Table Display */}
                    <div className="bg-[#0e1020] border border-[#2a2c45] p-4 rounded-2xl flex-1 max-h-[400px] overflow-y-auto scrollbar-hide">
                        <h3 className="text-xs font-black text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                            Payout Scale ({selectedNumbers.length} Picks)
                        </h3>
                        
                        <div className="space-y-1">
                            {selectedNumbers.length === 0 ? (
                                <div className="text-center text-gray-600 text-xs py-10 italic">Select runes to view prophecy.</div>
                            ) : (
                                Object.entries(payoutTable).map(([hits, mult]: [string, any]) => {
                                    const hitNum = parseInt(hits);
                                    const isCurrent = matches.length === hitNum;
                                    
                                    return (
                                        <div key={hits} className={`flex justify-between items-center p-2 rounded text-xs transition-all ${isCurrent ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'text-gray-400'}`}>
                                            <div className="font-bold">{hitNum}x Matches</div>
                                            <div className="font-mono font-black">{mult}x</div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="bg-[#0e1020] border border-[#2a2c45] p-4 rounded-2xl">
                        <div className="mb-4">
                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Wager Amount</label>
                            <input 
                                type="number" 
                                value={wager}
                                onChange={(e) => setWager(e.target.value)}
                                disabled={isPlaying}
                                className="w-full bg-[#080a16] border border-[#2a2c45] rounded-xl p-3 text-white font-mono font-bold text-sm focus:border-cyan-400 outline-none transition-colors disabled:opacity-50"
                            />
                        </div>

                        {isPlaying && winAmount > 0 ? (
                            <div className="w-full py-4 bg-green-500/10 border border-green-500 text-green-400 font-black uppercase text-center rounded-xl animate-pulse">
                                WIN: {winAmount.toLocaleString()}
                            </div>
                        ) : (
                            <button 
                                onClick={play}
                                disabled={isPlaying || selectedNumbers.length === 0}
                                className={`
                                    w-full py-4 font-black uppercase text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2
                                    ${isPlaying || selectedNumbers.length === 0 
                                        ? 'bg-[#2a2c45] text-gray-500 cursor-not-allowed' 
                                        : 'bg-cyan-400 text-black hover:bg-white hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(34,211,238,0.4)]'
                                    }
                                `}
                            >
                                {isPlaying ? 'Channeling...' : 'Cast Runes'}
                            </button>
                        )}
                        
                        <div className="flex justify-between mt-3">
                            <button onClick={() => !isPlaying && setSelectedNumbers([])} className="text-[10px] text-red-400 hover:text-white uppercase font-bold">Clear</button>
                            <button 
                                onClick={() => {
                                    if(isPlaying) return;
                                    const rand = [];
                                    while(rand.length < 10) {
                                        const r = Math.floor(Math.random() * 40) + 1;
                                        if(!rand.includes(r)) rand.push(r);
                                    }
                                    setSelectedNumbers(rand);
                                }} 
                                className="text-[10px] text-cyan-400 hover:text-white uppercase font-bold"
                            >
                                Random 10
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
