
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { GameService } from '../services/gameService';
import { playTickSound, playWinSound } from '../constants';

export const Wheel: React.FC = () => {
    const navigate = useNavigate();
    const { user, login, balance, refreshBalance } = useAuth();

    const [wager, setWager] = useState<string>('100');
    const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
    const [isSpinning, setIsSpinning] = useState(false);
    const [lastMultiplier, setLastMultiplier] = useState<number | null>(null);
    
    // Configs
    const segmentsConfig: Record<string, number[]> = {
        low: [1.5, 1.2, 1.2, 1.2, 0, 0, 1.5, 1.2, 1.2, 1.2, 0, 0], 
        medium: [2.0, 3.0, 0, 1.5, 0, 0, 2.0, 3.0, 0, 1.5, 0, 0], 
        high: [5.0, 0, 0, 0, 0, 0, 5.0, 0, 0, 0, 0, 0], 
    };

    const currentSegments = segmentsConfig[risk];
    const segmentAngle = 360 / currentSegments.length;

    // Animation Refs
    const wheelRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<number>(0);
    const currentRotationRef = useRef(0);
    const targetRotationRef = useRef(0);
    const startRotationRef = useRef(0);
    const startTimeRef = useRef(0);
    const lastSegmentIndexRef = useRef(-1);

    // Cleanup
    useEffect(() => {
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, []);

    const easeOutCubic = (x: number): number => {
        return 1 - Math.pow(1 - x, 3);
    };

    const getSegmentIndexAtRotation = (rot: number) => {
        // Pointer is at Top (0 deg). Wheel rotates clockwise.
        // Effective angle under pointer = (360 - (rot % 360)) % 360
        const angle = (360 - (rot % 360)) % 360;
        return Math.floor(angle / segmentAngle);
    };

    const animate = (time: number) => {
        if (!startTimeRef.current) startTimeRef.current = time;
        const elapsed = time - startTimeRef.current;
        const duration = 4000;

        const progress = Math.min(elapsed / duration, 1);
        const ease = easeOutCubic(progress);

        const currentRot = startRotationRef.current + (targetRotationRef.current - startRotationRef.current) * ease;
        currentRotationRef.current = currentRot;

        if (wheelRef.current) {
            wheelRef.current.style.transform = `rotate(${currentRot}deg)`;
        }

        // Sound Logic
        const currentIdx = getSegmentIndexAtRotation(currentRot);
        if (currentIdx !== lastSegmentIndexRef.current && progress < 1) {
            playTickSound();
            lastSegmentIndexRef.current = currentIdx;
        }

        if (progress < 1) {
            animRef.current = requestAnimationFrame(animate);
        } else {
            // Finished
            playWinSound();
            setIsSpinning(false);
            // Balance update logic handled in the main function state update
        }
    };

    const handleSpin = async () => {
        if (!user) { login(); return; }
        const amount = parseInt(wager);
        if (isNaN(amount) || amount <= 0 || amount > balance) return;

        setIsSpinning(true);
        setLastMultiplier(null);

        // Visual deduction of wager immediately
        refreshBalance(balance - amount);

        const randomIndex = Math.floor(Math.random() * currentSegments.length);
        const multiplier = currentSegments[randomIndex];
        const payout = Math.floor(amount * multiplier);

        try {
            const txResult = await GameService.arcadeAtomicTx(user.id, 'wheel', amount, payout, { risk, multiplier });
            
            // Calculate Rotation
            const spins = 5;
            const baseRotation = 360 * spins;
            
            // Center of target segment
            const centerAngle = randomIndex * segmentAngle + (segmentAngle / 2);
            
            // We want pointer (0 deg) to land on centerAngle
            // So wheel rotation mod 360 must be (360 - centerAngle)
            // target = current + base + dist
            
            const currentMod = currentRotationRef.current % 360;
            const targetMod = (360 - centerAngle) % 360;
            
            let dist = targetMod - currentMod;
            if (dist < 0) dist += 360;
            
            // Add jitter
            const jitter = (Math.random() - 0.5) * (segmentAngle * 0.8);

            startRotationRef.current = currentRotationRef.current;
            targetRotationRef.current = currentRotationRef.current + baseRotation + dist + jitter;
            startTimeRef.current = 0;
            lastSegmentIndexRef.current = getSegmentIndexAtRotation(startRotationRef.current);

            animRef.current = requestAnimationFrame(animate);

            setTimeout(() => {
                setLastMultiplier(multiplier);
                if (txResult && typeof txResult.newBalance === 'number') {
                    refreshBalance(txResult.newBalance);
                } else {
                    refreshBalance();
                }
            }, 4000);

        } catch (e: any) {
            alert(e.message);
            setIsSpinning(false);
            refreshBalance(); // Revert/Fetch on error
        }
    };

    return (
        <div className="container mx-auto p-4 max-w-5xl min-h-[85vh] flex flex-col items-center">
            <button onClick={() => navigate('/games')} className="self-start text-xs font-bold text-muted hover:text-white uppercase tracking-widest mb-8">← Back</button>

            <div className="flex flex-col lg:flex-row gap-12 w-full items-center">
                
                {/* WHEEL - NOW FIRST */}
                <div className="flex-1 flex justify-center items-center relative p-10">
                    {/* Pointer */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-white drop-shadow-lg"></div>

                    <div className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] relative">
                        <div 
                            ref={wheelRef}
                            className="w-full h-full rounded-full border-8 border-[#1a1d2e] shadow-2xl relative overflow-hidden bg-[#0e1020]"
                            style={{ transform: `rotate(${currentRotationRef.current}deg)` }}
                        >
                            <svg viewBox="-100 -100 200 200" className="absolute inset-0 w-full h-full transform -rotate-90">
                                {currentSegments.map((mult, idx) => {
                                    const startAngle = (idx * segmentAngle) * Math.PI / 180;
                                    const endAngle = ((idx + 1) * segmentAngle) * Math.PI / 180;
                                    const x1 = 100 * Math.cos(startAngle);
                                    const y1 = 100 * Math.sin(startAngle);
                                    const x2 = 100 * Math.cos(endAngle);
                                    const y2 = 100 * Math.sin(endAngle);
                                    
                                    const isZero = mult === 0;
                                    const fill = isZero ? '#1f2937' : idx % 2 === 0 ? '#a855f7' : '#e9d5ff';
                                    const textFill = isZero ? '#6b7280' : idx % 2 === 0 ? '#fff' : '#000';

                                    return (
                                        <g key={idx}>
                                            <path d={`M 0 0 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`} fill={fill} stroke="#0e1020" strokeWidth="1" />
                                            {/* Text Label */}
                                            <text 
                                                x={70 * Math.cos(startAngle + (endAngle - startAngle)/2)} 
                                                y={70 * Math.sin(startAngle + (endAngle - startAngle)/2)} 
                                                fill={textFill}
                                                fontSize="12"
                                                fontWeight="900"
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                transform={`rotate(${(idx * segmentAngle + segmentAngle/2)}, ${70 * Math.cos(startAngle + (endAngle - startAngle)/2)}, ${70 * Math.sin(startAngle + (endAngle - startAngle)/2)})`}
                                            >
                                                {mult}x
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                        
                        {/* Center Hub */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-[#1a1d2e] rounded-full border-4 border-white/20 shadow-xl flex items-center justify-center z-10">
                            <span className="text-xl">🟣</span>
                        </div>
                    </div>
                </div>

                {/* CONTROLS - NOW SECOND & COMPACT */}
                <div className="bg-[#0e1020] border border-[#2a2c45] p-4 rounded-2xl w-full lg:w-56 shrink-0 h-fit">
                    <h2 className="text-lg font-black text-white uppercase italic tracking-tighter mb-4">Wheel Config</h2>
                    
                    <div className="mb-4">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Wager</label>
                        <input 
                            type="number" 
                            disabled={isSpinning}
                            value={wager}
                            onChange={(e) => setWager(e.target.value)}
                            className="w-full bg-[#080a16] border border-[#2a2c45] rounded-lg p-2 text-white font-mono font-bold text-sm focus:border-neon1 outline-none disabled:opacity-50"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Risk Mode</label>
                        <div className="flex bg-[#1a1d2e] p-1 rounded-lg">
                            {['low', 'medium', 'high'].map(r => (
                                <button
                                    key={r}
                                    onClick={() => setRisk(r as any)}
                                    disabled={isSpinning}
                                    className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${risk === r ? 'bg-purple-500 text-white' : 'text-gray-500 hover:text-white'}`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={handleSpin}
                        disabled={isSpinning}
                        className="w-full py-3 bg-purple-500 text-white font-black uppercase rounded-lg hover:bg-purple-400 transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] active:scale-95 disabled:opacity-50 text-xs"
                    >
                        {isSpinning ? 'Spinning...' : 'SPIN WHEEL'}
                    </button>

                    {lastMultiplier !== null && (
                        <div className="mt-4 text-center animate-bounce-in">
                            <div className="text-[9px] text-gray-500 uppercase font-bold">Result</div>
                            <div className={`text-2xl font-black ${lastMultiplier > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                                {lastMultiplier.toFixed(1)}x
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
