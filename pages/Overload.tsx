import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { GameService } from '../services/gameService';
import { playBombSound, playTickSound, playWinSound } from '../constants';

export const Overload: React.FC = () => {
    const navigate = useNavigate();
    const { user, login, balance, refreshBalance } = useAuth();

    // Game State
    const [wager, setWager] = useState<string>('100');
    const [gameState, setGameState] = useState<'idle' | 'running' | 'crashed' | 'cashed'>('idle');
    const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
    const [crashPoint, setCrashPoint] = useState(0);
    const [winAmount, setWinAmount] = useState(0);
    const [history, setHistory] = useState<{ crash: number, date: string }[]>([]);
    
    // Prevention for double clicks
    const [isProcessing, setIsProcessing] = useState(false);

    // Refs
    const startTimeRef = useRef(0);
    const animationFrameRef = useRef(0);
    const hasCashedOutRef = useRef(false);

    useEffect(() => {
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, []);

    const startGame = async () => {
        if (isProcessing) return;
        if (!user) { login(); return; }
        const amount = parseInt(wager);
        if (isNaN(amount) || amount <= 0 || amount > balance) return;

        setIsProcessing(true);

        // Visual Deduct
        refreshBalance(balance - amount);

        try {
            // DB Deduct
            await GameService.arcadeDeduct(user.id, 'overload', amount);
            
            setGameState('running');
            setCurrentMultiplier(1.00);
            setWinAmount(0);
            hasCashedOutRef.current = false;

            // Generate Crash Point (RTP ~96%)
            let point = 1.00;
            if (Math.random() > 0.04) { // 4% instant crash
                point = 0.96 / (1 - Math.random());
                point = Math.max(1.01, point);
            } else {
                point = 1.00;
            }
            point = Math.min(point, 10000); 
            
            setCrashPoint(point);

            // Start Loop
            startTimeRef.current = performance.now();
            loop();

        } catch (e: any) {
            alert(e.message);
            refreshBalance(); // Revert
        } finally {
            setIsProcessing(false);
        }
    };

    const loop = () => {
        const now = performance.now();
        const elapsed = (now - startTimeRef.current) / 1000;
        
        // Growth Function
        const nextMult = 1.00 + Math.pow(elapsed * 1.5, 2.5) * 0.05;
        const displayMult = Math.max(1.00, nextMult);

        if (displayMult >= crashPoint) {
            // CRASH
            setGameState('crashed');
            setCurrentMultiplier(crashPoint);
            setHistory(prev => [{ crash: crashPoint, date: new Date().toISOString() }, ...prev].slice(0, 10));
            playBombSound();
            // No DB call needed for loss (already deducted)
        } else {
            setCurrentMultiplier(displayMult);
            animationFrameRef.current = requestAnimationFrame(loop);
            if (Math.random() < 0.1) playTickSound();
        }
    };

    const handleEject = async () => {
        if (gameState !== 'running' || hasCashedOutRef.current) return;
        hasCashedOutRef.current = true;
        
        const payout = Math.floor(parseInt(wager) * currentMultiplier);
        setWinAmount(payout);
        setGameState('cashed');
        playWinSound();

        // Add payout to deducted balance
        // Current 'balance' in context is (Original - Wager) due to optimistic update in startGame
        // So we just add payout
        refreshBalance(balance + payout); 

        try {
            await GameService.arcadePayout(user?.id || '', 'overload', payout);
        } catch (e) {
            console.error("Payout failed", e);
            // In real app, retry logic needed
        }
    };

    // Derived Visuals
    const isCrashed = gameState === 'crashed';
    const isCashed = gameState === 'cashed';
    const shakeAmount = gameState === 'running' ? Math.min((currentMultiplier - 1) * 2, 10) : 0;

    return (
        <div className="container mx-auto p-4 max-w-5xl min-h-[85vh] flex flex-col items-center">
            <button onClick={() => navigate('/games')} className="self-start text-xs font-bold text-muted hover:text-white uppercase tracking-widest mb-8">← Back</button>

            <div className="flex flex-col gap-8 w-full items-center">
                
                {/* GAME AREA */}
                <div className="w-full max-w-2xl aspect-square sm:aspect-video bg-[#0e1020] border border-[#2a2c45] rounded-3xl relative overflow-hidden flex items-center justify-center shadow-2xl">
                    <div className={`absolute inset-0 opacity-20 pointer-events-none transition-transform duration-[50ms]`} 
                         style={{ 
                             backgroundImage: 'linear-gradient(#2a2c45 1px, transparent 1px), linear-gradient(90deg, #2a2c45 1px, transparent 1px)', 
                             backgroundSize: '40px 40px',
                             transform: `translate(${Math.random() * shakeAmount}px, ${Math.random() * shakeAmount}px)`
                         }}>
                    </div>

                    <div className="relative z-10 text-center">
                        <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-all duration-100
                            ${isCrashed ? 'bg-red-500/40 w-96 h-96' : 'bg-orange-500/20 w-64 h-64'}
                            ${gameState === 'running' ? 'animate-pulse' : ''}
                        `}></div>

                        <div className={`relative text-7xl sm:text-9xl font-black font-mono tracking-tighter transition-colors duration-100 z-20
                            ${isCrashed ? 'text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]' : 
                              isCashed ? 'text-green-400 drop-shadow-[0_0_30px_rgba(34,197,94,0.5)]' : 
                              'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]'}
                        `}>
                            {currentMultiplier.toFixed(2)}x
                        </div>

                        <div className="mt-4 text-sm font-bold uppercase tracking-[0.3em] text-center">
                            {isCrashed ? <span className="text-red-500 animate-pulse">SYSTEM FAILURE</span> :
                             isCashed ? <span className="text-green-400">EJECTION SUCCESSFUL</span> :
                             gameState === 'running' ? <span className="text-orange-400">CORE UNSTABLE</span> :
                             <span className="text-gray-600">READY TO IGNITE</span>}
                        </div>
                        
                        {isCashed && (
                            <div className="mt-2 text-2xl font-black text-green-400 animate-bounce-in">
                                +{winAmount.toLocaleString()} GP
                            </div>
                        )}
                    </div>
                </div>

                {/* CONTROLS */}
                <div className="bg-[#0e1020] border border-[#2a2c45] p-4 rounded-2xl w-full max-w-2xl shrink-0">
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Wager Amount</label>
                            <input 
                                type="number" 
                                value={wager}
                                onChange={(e) => setWager(e.target.value)}
                                disabled={gameState === 'running' || isProcessing}
                                className="w-full bg-[#080a16] border border-[#2a2c45] rounded-xl p-3 text-white font-mono font-bold text-lg focus:border-neon1 outline-none transition-colors disabled:opacity-50"
                            />
                        </div>

                        <div className="w-full sm:w-auto">
                            {gameState === 'running' && !isCashed ? (
                                <button 
                                    onClick={handleEject}
                                    className="w-full sm:w-48 py-4 bg-orange-500 text-black font-black uppercase text-xl rounded-xl hover:bg-orange-400 hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(249,115,22,0.4)] animate-pulse"
                                >
                                    EJECT
                                </button>
                            ) : (
                                <button 
                                    onClick={startGame}
                                    disabled={isProcessing}
                                    className="w-full sm:w-48 py-4 bg-neon1 text-black font-black uppercase text-lg rounded-xl hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isProcessing ? 'IGNITING...' : 'IGNITE'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* HISTORY */}
                <div className="w-full max-w-2xl overflow-x-auto pb-4 scrollbar-hide">
                    <div className="flex gap-2">
                        {history.map((h, i) => (
                            <div key={i} className={`flex-shrink-0 px-3 py-1 rounded bg-[#1a1d2e] border text-xs font-mono font-bold ${h.crash >= 2.0 ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'}`}>
                                {h.crash.toFixed(2)}x
                            </div>
                        ))}
                        {history.length === 0 && <div className="text-xs text-gray-600 italic">No recent data</div>}
                    </div>
                </div>

            </div>
        </div>
    );
};