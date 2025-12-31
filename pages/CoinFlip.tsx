
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { GameService } from '../services/gameService';
import { CoinFlipEntry } from '../types';
import { playCoinFlipSound } from '../constants';

export const CoinFlip: React.FC = () => {
    const navigate = useNavigate();
    const { user, login, balance, refreshBalance } = useAuth();
    
    // Game State
    const [wager, setWager] = useState<string>('100');
    const [side, setSide] = useState<'heads' | 'tails'>('heads');
    const [isFlipping, setIsFlipping] = useState(false);
    const [lastResult, setLastResult] = useState<CoinFlipEntry | null>(null);
    const [history, setHistory] = useState<CoinFlipEntry[]>([]);
    
    // Animation State
    const coinRef = useRef<HTMLDivElement>(null);
    const currentRotation = useRef(0);

    // Initial Data Load
    useEffect(() => {
        if (user) {
            GameService.getCoinFlipHistory(user.id).then(setHistory);
        }
    }, [user]);

    const handleFlip = async () => {
        if (!user) { login(); return; }
        
        const wagerAmount = parseInt(wager);
        if (isNaN(wagerAmount) || wagerAmount <= 0) {
            alert("Please enter a valid wager.");
            return;
        }
        if (wagerAmount > balance) {
            alert("Insufficient funds.");
            return;
        }

        setIsFlipping(true);
        setLastResult(null);
        
        // Play Sound
        playCoinFlipSound();

        // Optimistic deduction
        await refreshBalance(balance - wagerAmount);

        try {
            const result = await GameService.flipCoin(user.id, wagerAmount, side);
            
            const isHeadsOutcome = result.outcome === 'heads';
            
            const extraSpins = 1800 + (Math.random() * 360); 
            let nextRotation = currentRotation.current + extraSpins;
            const remainder = nextRotation % 360;
            
            if (isHeadsOutcome) {
                nextRotation += (360 - remainder);
            } else {
                nextRotation += (180 - remainder) + 360;
            }

            currentRotation.current = nextRotation;

            if (coinRef.current) {
                coinRef.current.style.transform = `rotateX(${nextRotation}deg)`;
            }

            setTimeout(async () => {
                setLastResult(result);
                setHistory(prev => [result, ...prev]);
                if (result.won) {
                    await refreshBalance();
                }
                setIsFlipping(false);
            }, 3000);

        } catch (e: any) {
            alert(e.message);
            setIsFlipping(false);
            refreshBalance();
        }
    };

    const setWagerPercent = (percent: number) => {
        setWager(Math.floor(balance * percent).toString());
    };

    return (
        <div className="container mx-auto p-4 max-w-4xl min-h-[85vh] flex flex-col items-center">
            
            <button onClick={() => navigate('/games')} className="self-start text-xs font-bold text-muted hover:text-white uppercase tracking-widest mb-8">
                ← Back to Arcade
            </button>

            {/* Reduced gap */}
            <div className="flex flex-col gap-8 items-center w-full justify-center mb-12">
                
                {/* --- 3D COIN ANIMATION (TOP) --- */}
                <div className="w-64 h-64 relative perspective-1000 shrink-0 my-4">
                    <div 
                        ref={coinRef}
                        className="w-full h-full relative preserve-3d transition-transform duration-[3000ms] ease-out-cubic"
                        style={{ transformStyle: 'preserve-3d' }}
                    >
                        {/* HEADS (FRONT) */}
                        <div className="absolute inset-0 w-full h-full rounded-full backface-hidden bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 shadow-[0_0_50px_rgba(234,179,8,0.4)] flex items-center justify-center border-4 border-yellow-200">
                            <div className="w-[90%] h-[90%] rounded-full border-2 border-dashed border-yellow-800/30 flex items-center justify-center">
                                <span className="text-6xl font-black text-yellow-900 drop-shadow-sm">H</span>
                            </div>
                        </div>

                        {/* TAILS (BACK) */}
                        <div 
                            className="absolute inset-0 w-full h-full rounded-full backface-hidden bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 shadow-[0_0_50px_rgba(156,163,175,0.4)] flex items-center justify-center border-4 border-gray-200"
                            style={{ transform: 'rotateX(180deg)' }}
                        >
                            <div className="w-[90%] h-[90%] rounded-full border-2 border-dashed border-gray-700/30 flex items-center justify-center">
                                <span className="text-6xl font-black text-gray-800 drop-shadow-sm">T</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/50 blur-xl rounded-[100%] transition-all duration-300" 
                         style={{ transform: isFlipping ? 'scale(0.5)' : 'scale(1)' }}></div>
                </div>

                {/* --- CONTROLS (BOTTOM) - COMPACT --- */}
                <div className="bg-[#0e1020] border border-[#2a2c45] p-3 rounded-2xl w-full max-w-[280px] shadow-2xl relative z-10">
                    <h2 className="text-xs font-black text-white uppercase italic tracking-tighter mb-2">Wager Station</h2>
                    
                    {/* Side Selection */}
                    <div className="flex bg-[#1a1d2e] p-0.5 rounded-lg mb-2 border border-white/5">
                        <button 
                            onClick={() => !isFlipping && setSide('heads')}
                            className={`flex-1 py-1.5 rounded-md font-black uppercase text-[10px] tracking-wider transition-all ${side === 'heads' ? 'bg-yellow-400 text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                            disabled={isFlipping}
                        >
                            Heads
                        </button>
                        <button 
                            onClick={() => !isFlipping && setSide('tails')}
                            className={`flex-1 py-1.5 rounded-md font-black uppercase text-[10px] tracking-wider transition-all ${side === 'tails' ? 'bg-gray-300 text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                            disabled={isFlipping}
                        >
                            Tails
                        </button>
                    </div>

                    {/* Wager Input */}
                    <div className="mb-2">
                        <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 block">Wager Amount</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={wager}
                                onChange={(e) => setWager(e.target.value)}
                                className="w-full bg-[#080a16] border border-[#2a2c45] rounded-lg p-2 text-white font-mono font-bold text-xs focus:border-neon1 outline-none transition-colors"
                                disabled={isFlipping}
                            />
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                                <button onClick={() => setWagerPercent(0.5)} disabled={isFlipping} className="px-1.5 py-0.5 bg-[#1a1d2e] rounded text-[8px] font-bold text-gray-400 hover:text-white">1/2</button>
                                <button onClick={() => setWagerPercent(1)} disabled={isFlipping} className="px-1.5 py-0.5 bg-[#1a1d2e] rounded text-[8px] font-bold text-gray-400 hover:text-white">MAX</button>
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button 
                        onClick={handleFlip}
                        disabled={isFlipping}
                        className={`w-full py-2 rounded-lg font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_0_20px_rgba(250,204,21,0.3)] transition-all transform active:scale-95 ${isFlipping ? 'bg-gray-600 cursor-not-allowed opacity-50' : 'bg-yellow-400 text-black hover:bg-white'}`}
                    >
                        {isFlipping ? 'FLIPPING...' : 'FLIP COIN'}
                    </button>

                    {/* Outcome Message */}
                    {lastResult && !isFlipping && (
                        <div className={`mt-2 p-1.5 rounded text-center border animate-slide-in-up ${lastResult.won ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                            <div className={`text-xs font-black italic uppercase ${lastResult.won ? 'text-green-400' : 'text-red-500'}`}>
                                {lastResult.won ? 'YOU WON!' : 'YOU LOST'}
                            </div>
                            <div className="text-[9px] font-bold text-white">
                                {lastResult.won ? `+${lastResult.payout.toLocaleString()} GP` : `-${lastResult.wager.toLocaleString()} GP`}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- HISTORY --- */}
            <div className="w-full max-w-2xl mt-4">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 text-center">Recent Flips</h3>
                <div className="flex gap-2 overflow-x-auto pb-4 justify-center scrollbar-hide">
                    {history.map((entry) => (
                        <div key={entry.id} className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black border-2 shadow-lg animate-fade-in ${entry.won ? 'bg-green-500 text-black border-green-400' : 'bg-[#1a1d2e] text-gray-500 border-gray-700'}`}>
                            {entry.outcome === 'heads' ? 'H' : 'T'}
                        </div>
                    ))}
                    {history.length === 0 && <span className="text-[10px] text-gray-700 italic">No history yet.</span>}
                </div>
            </div>

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .ease-out-cubic { transition-timing-function: cubic-bezier(0.33, 1, 0.68, 1); }
            `}</style>
        </div>
    );
};
