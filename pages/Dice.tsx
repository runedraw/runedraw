
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { GameService } from '../services/gameService';
import { playDiceRollSound } from '../constants';

export const Dice: React.FC = () => {
    const navigate = useNavigate();
    const { user, login, balance, refreshBalance } = useAuth();

    const [wager, setWager] = useState<string>('100');
    const [target, setTarget] = useState(50);
    const [condition, setCondition] = useState<'under' | 'over'>('under');
    const [isRolling, setIsRolling] = useState(false);
    const [rollResult, setRollResult] = useState<number | null>(null);
    const [winAmount, setWinAmount] = useState<number | null>(null);

    const winChance = condition === 'under' ? target : 100 - target;
    const multiplier = winChance > 0 ? 98 / winChance : 0; // 2% house edge
    const potentialWin = Math.floor(parseInt(wager) * multiplier);

    const handleRoll = async () => {
        if (!user) { login(); return; }
        const amount = parseInt(wager);
        if (isNaN(amount) || amount <= 0 || amount > balance) return;

        setIsRolling(true);
        setRollResult(null);
        setWinAmount(null);
        
        // Play Sound with Duration matching the animation (500ms)
        playDiceRollSound(500);

        // Instant visual deduction
        refreshBalance(balance - amount);

        // RNG
        const roll = Math.random() * 100;
        const won = condition === 'under' ? roll < target : roll > target;
        const payout = won ? potentialWin : 0;

        try {
            const tx = await GameService.arcadeAtomicTx(user.id, 'dice', amount, payout, { target, condition, roll });
            
            // Animation Sim
            let tempRoll = 0;
            const interval = setInterval(() => {
                tempRoll = Math.random() * 100;
                setRollResult(tempRoll);
            }, 50);

            setTimeout(() => {
                clearInterval(interval);
                setRollResult(roll);
                setWinAmount(payout);
                setIsRolling(false);
                // Update to final balance from server only after animation
                if (tx && typeof tx.newBalance === 'number') {
                    refreshBalance(tx.newBalance);
                } else {
                    refreshBalance();
                }
            }, 500);

        } catch (e: any) {
            alert(e.message);
            refreshBalance(); // Revert
            setIsRolling(false);
        }
    };

    return (
        <div className="container mx-auto p-4 max-w-4xl min-h-[85vh] flex flex-col items-center">
            <button onClick={() => navigate('/games')} className="self-start text-xs font-bold text-muted hover:text-white uppercase tracking-widest mb-8">← Back</button>

            {/* Reduced padding */}
            <div className="w-full bg-[#0e1020] border border-[#2a2c45] p-4 rounded-3xl shadow-2xl relative overflow-hidden">
                {/* Result Display - Heavily increased bottom margin to prevent badge overlap with slider */}
                <div className="flex justify-center mb-16 relative h-20 items-center">
                    {rollResult !== null ? (
                        <div className={`text-4xl sm:text-5xl font-black ${winAmount && winAmount > 0 ? 'text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'text-gray-500'} font-mono`}>
                            {rollResult.toFixed(2)}
                        </div>
                    ) : (
                        <div className="text-4xl sm:text-5xl font-black text-gray-700 opacity-20 font-mono">00.00</div>
                    )}
                    
                    {/* Win Badge - Positioned below the number */}
                    {winAmount !== null && winAmount > 0 && !isRolling && (
                        <div className="absolute top-full mt-3 bg-green-500/20 border border-green-500 text-green-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-slide-in-up z-20 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                            +{winAmount.toLocaleString()} GP
                        </div>
                    )}
                </div>

                {/* Slider - Compact */}
                <div className="relative h-10 bg-[#1a1d2e] rounded-lg mb-6 flex items-center px-0 border border-[#2a2c45] shadow-inner overflow-hidden mx-4">
                    
                    {/* Visual Bar Background */}
                    <div className="absolute left-0 top-0 bottom-0 bg-red-500/20 w-full"></div>
                    
                    {/* Winning Zone */}
                    <div 
                        className="absolute top-0 bottom-0 bg-green-500/40 transition-all duration-300" 
                        style={{ 
                            left: condition === 'under' ? '0%' : `${target}%`, 
                            width: condition === 'under' ? `${target}%` : `${100-target}%`
                        }}
                    ></div>

                    {/* Result Marker (Animated Line) */}
                    {rollResult !== null && (
                        <div 
                            className="absolute top-0 bottom-0 w-1 bg-white z-20 shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-all duration-75 ease-linear"
                            style={{ left: `${rollResult}%` }}
                        >
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-black bg-white text-black px-1 rounded">
                                {rollResult.toFixed(0)}
                            </div>
                        </div>
                    )}

                    {/* Target Handle (Draggable) */}
                    <input 
                        type="range" min="2" max="98" step="1"
                        value={target} onChange={(e) => setTarget(parseInt(e.target.value))}
                        disabled={isRolling}
                        className="w-full h-full opacity-0 z-30 cursor-pointer absolute inset-0"
                    />
                    
                    {/* Handle Visual */}
                    <div 
                        className="absolute top-0 bottom-0 w-1 bg-neon1 z-10 pointer-events-none transition-all duration-100 flex flex-col items-center justify-center"
                        style={{ left: `${target}%` }}
                    >
                        <div className="w-6 h-6 bg-[#0e1020] border-2 border-neon1 rounded flex items-center justify-center text-[9px] font-bold text-white shadow-lg">
                            {target}
                        </div>
                    </div>
                </div>

                {/* Controls - Compact */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                        <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Multiplier</label>
                        <div className="text-sm font-black text-white">{multiplier.toFixed(4)}x</div>
                    </div>
                    
                    <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                        <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Win Chance</label>
                        <div className="text-sm font-black text-white">{winChance.toFixed(0)}%</div>
                    </div>

                    <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                        <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Wager</label>
                        <input 
                            type="number" 
                            disabled={isRolling}
                            value={wager}
                            onChange={(e) => setWager(e.target.value)}
                            className="w-full bg-transparent text-sm font-black text-white outline-none border-b border-white/20 focus:border-neon1"
                        />
                    </div>
                </div>

                <div className="flex justify-center gap-2 mt-4">
                    <button 
                        onClick={() => setCondition('under')} 
                        className={`flex-1 px-2 py-2 rounded-lg font-bold uppercase text-[9px] transition-all ${condition === 'under' ? 'bg-white text-black' : 'bg-[#1a1d2e] text-gray-500'}`}
                    >
                        Roll Under
                    </button>
                    <button 
                        onClick={() => setCondition('over')} 
                        className={`flex-1 px-2 py-2 rounded-lg font-bold uppercase text-[9px] transition-all ${condition === 'over' ? 'bg-white text-black' : 'bg-[#1a1d2e] text-gray-500'}`}
                    >
                        Roll Over
                    </button>
                </div>

                <button 
                    onClick={handleRoll}
                    disabled={isRolling}
                    className="w-full mt-4 py-3 bg-green-500 text-black font-black uppercase text-sm rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:bg-white hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isRolling ? 'Rolling...' : 'ROLL DICE'}
                </button>
            </div>
        </div>
    );
};
