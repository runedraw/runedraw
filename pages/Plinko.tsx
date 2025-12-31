
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { GameService } from '../services/gameService';
import { playPlinkoBounce, playPlinkoLand } from '../constants';

export const Plinko: React.FC = () => {
    const navigate = useNavigate();
    const { user, login, balance, refreshBalance } = useAuth();
    
    const [wager, setWager] = useState<string>('100');
    const [rows, setRows] = useState(12);
    const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
    const [isDropping, setIsDropping] = useState(false);
    const [lastMultiplier, setLastMultiplier] = useState<number | null>(null);
    const [history, setHistory] = useState<number[]>([]);

    // Canvas
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<any[]>([]);
    const animationIdRef = useRef<number>(0);
    
    // Balance Ref to handle rapid incremental updates without race conditions
    const balanceRef = useRef(balance);

    // Sync ref with global balance, but only if we are idle (to prevent jitter during animation)
    useEffect(() => {
        balanceRef.current = balance;
    }, [balance]);
    
    // Visual Constants
    const PADDING_X = 20; 
    const PADDING_TOP = 30; 
    const BUCKET_AREA_HEIGHT = 140; // Increased to allow staggered text

    // Multipliers Config
    const getMultipliers = (r: number, risk: string) => {
        const count = r + 1;
        const half = Math.floor(count / 2);
        const mults = [];
        const riskFactor = risk === 'high' ? 30 : risk === 'medium' ? 10 : 3;
        
        for (let i = 0; i < count; i++) {
            const distFromCenter = Math.abs(i - half);
            let val = 0.2 + (Math.pow(distFromCenter, 2.5) / Math.pow(half, 2.5)) * riskFactor;
            if (distFromCenter === 0) val = 0.3; 
            mults.push(parseFloat(val.toFixed(1)));
        }
        return mults;
    };

    const multipliers = getMultipliers(rows, risk);

    useEffect(() => {
        return () => {
            if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isDropping && particlesRef.current.length === 0) {
            drawStaticBoard();
        }
    }, [rows, risk]);

    const handleDrop = async () => {
        if (!user) { login(); return; }
        const amount = parseInt(wager);
        if (isNaN(amount) || amount <= 0 || amount > balanceRef.current) return;

        setIsDropping(true);
        setLastMultiplier(null);

        // Immediate visual deduction from Ref
        const newBalance = balanceRef.current - amount;
        balanceRef.current = newBalance;
        refreshBalance(newBalance);

        let path = [];
        let currentX = 0; 
        
        for (let i = 0; i < rows; i++) {
            const dir = Math.random() < 0.5 ? -0.5 : 0.5; 
            path.push(dir);
            currentX += dir;
        }
        
        const finalIndex = Math.floor(currentX + rows / 2);
        const outcomeMult = multipliers[finalIndex] || 0;
        const payout = Math.floor(amount * outcomeMult);

        try {
            // Atomic TX records the full transaction on server
            await GameService.arcadeAtomicTx(user.id, 'plinko', amount, payout, { rows, risk, path });
            // Do NOT add payout here. Pass it to the ball for delayed crediting.
            spawnBall(path, finalIndex, outcomeMult, payout);
        } catch (e: any) {
            alert(e.message);
            refreshBalance(); // Revert balance on error (fetch from server)
            setIsDropping(false);
        }
    };

    const spawnBall = (path: number[], targetIndex: number, multiplier: number, payout: number) => {
        const ball = {
            x: 0, 
            y: 0, 
            path: path,
            row: 0,
            progress: 0,
            id: Date.now(),
            targetIndex,
            multiplier,
            payout
        };
        particlesRef.current.push(ball);
        
        if (particlesRef.current.length === 1) {
            animationIdRef.current = requestAnimationFrame(animate);
        }
    };

    const drawStaticBoard = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = 1000; 
        canvas.height = 800;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBoardElements(ctx, canvas.width, canvas.height);
    }

    const drawBoardElements = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const availableHeight = height - PADDING_TOP - BUCKET_AREA_HEIGHT; 
        const rowHeight = availableHeight / rows;
        const pinRadius = 5;
        
        // Draw Pins
        ctx.fillStyle = '#2a2c45';
        for (let r = 0; r < rows; r++) {
            const cols = r + 3;
            const maxCols = rows + 3;
            // Tighter horizontal spacing
            const spacing = (width - PADDING_X) / maxCols; 
            
            const rowWidth = (cols - 1) * spacing;
            const startX = (width - rowWidth) / 2;
            
            for (let c = 0; c < cols; c++) {
                ctx.beginPath();
                ctx.arc(startX + c * spacing, PADDING_TOP + r * rowHeight, pinRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw Buckets
        const bottomCols = rows + 1;
        const maxCols = rows + 3;
        const spacing = (width - PADDING_X) / maxCols;
        const bucketWidth = spacing - 4; // Tighter gap
        const rowWidth = (bottomCols - 1) * spacing;
        const startBucketX = (width - rowWidth) / 2;
        
        for (let i = 0; i < bottomCols; i++) {
            const x = startBucketX + i * spacing - (bucketWidth/2);
            // Move buckets up slightly relative to bottom to fit text
            const y = height - BUCKET_AREA_HEIGHT + 20; 
            const bucketHeight = 110; 
            
            ctx.fillStyle = '#1a1d2e';
            ctx.beginPath();
            ctx.roundRect(x, y, bucketWidth, bucketHeight, 8);
            ctx.fill();
            ctx.strokeStyle = '#2a2c45';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            const mult = multipliers[i];
            
            ctx.fillStyle = mult >= 10 ? '#ff5a54' : mult >= 3 ? '#ffd700' : mult < 1 ? '#666' : '#fff';
            
            // Reduced font size slightly to ensure fit without overlap
            ctx.font = 'bold 22px "Chakra Petch", sans-serif'; 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Align all text to the vertical center of the bucket (removed staggering)
            const textY = y + (bucketHeight / 2);

            ctx.fillText(mult.toString() + 'x', x + bucketWidth/2, textY);
        }
    };

    const animate = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (canvas.width !== 1000) canvas.width = 1000;
        if (canvas.height !== 800) canvas.height = 800;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBoardElements(ctx, canvas.width, canvas.height);

        const availableHeight = canvas.height - PADDING_TOP - BUCKET_AREA_HEIGHT;
        const rowHeight = availableHeight / rows;
        const maxCols = rows + 3;
        const spacing = (canvas.width - PADDING_X) / maxCols; 

        // Update & Draw Balls
        particlesRef.current = particlesRef.current.filter(p => {
            const prevRow = Math.floor(p.progress);
            
            // Move physics
            p.progress += 0.04;
            
            const currentRow = Math.floor(p.progress);
            
            // Sound Trigger: If crossed a row boundary, play bounce
            if (currentRow > prevRow && currentRow < rows) {
                playPlinkoBounce();
            }
            
            if (currentRow >= rows) {
                // Ball finished
                playPlinkoLand();
                setLastMultiplier(p.multiplier);
                setHistory(prev => [p.multiplier, ...prev].slice(0, 10));
                
                // --- INCREMENTAL BALANCE UPDATE ---
                // Add this ball's specific payout to the local tracking ref
                if (p.payout > 0) {
                    balanceRef.current += p.payout;
                    refreshBalance(balanceRef.current);
                }

                if (particlesRef.current.length <= 1) setIsDropping(false);
                return false;
            }

            let currentXOffset = 0;
            for(let i=0; i<currentRow; i++) currentXOffset += (p.path[i] || 0);
            
            let nextXOffset = currentXOffset + (p.path[currentRow] || 0);
            
            const progressInRow = p.progress - currentRow;
            const startX = (canvas.width / 2) + (currentXOffset * spacing);
            const endX = (canvas.width / 2) + (nextXOffset * spacing);
            
            p.x = startX + (endX - startX) * progressInRow;
            p.y = PADDING_TOP + p.progress * rowHeight;
            
            // Draw Ball
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#6df9ff';
            ctx.shadowColor = '#6df9ff';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;

            return true;
        });

        if (particlesRef.current.length > 0) {
            animationIdRef.current = requestAnimationFrame(animate);
        } else {
            animationIdRef.current = 0;
        }
    };

    return (
        <div className="container mx-auto p-4 max-w-5xl min-h-[85vh] flex flex-col items-center">
            <button onClick={() => navigate('/games')} className="self-start text-xs font-bold text-muted hover:text-white uppercase tracking-widest mb-4">← Back</button>
            
            <div className="flex flex-col gap-4 w-full items-center">
                
                {/* Canvas Container */}
                <div className="w-full bg-[#0e1020] border border-[#2a2c45] rounded-3xl p-2 flex items-center justify-center relative overflow-hidden shadow-2xl">
                    <div className="w-full h-[60vh] sm:h-[75vh] max-h-[850px]">
                        <canvas 
                            ref={canvasRef}
                            className="w-full h-full object-contain"
                        />
                    </div>

                    {/* Prominent Win Display Overlay - Top Right */}
                    {lastMultiplier !== null && (
                        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl animate-bounce-in shadow-2xl z-20 flex flex-col items-end">
                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Last Win</span>
                            <span className={`text-4xl font-black ${lastMultiplier >= 1 ? 'text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'text-gray-500'}`}>
                                {lastMultiplier}x
                            </span>
                        </div>
                    )}
                </div>

                {/* Compact Control Bar */}
                <div className="bg-[#0e1020] border border-[#2a2c45] p-2 rounded-xl w-full max-w-3xl shrink-0">
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1 w-full">
                            <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 block">Wager</label>
                            <input 
                                type="number" 
                                value={wager}
                                onChange={(e) => setWager(e.target.value)}
                                className="w-full bg-[#080a16] border border-[#2a2c45] rounded p-1 text-white font-mono font-bold text-xs focus:border-neon1 outline-none h-8"
                            />
                        </div>

                        <div className="flex-1 w-full">
                            <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 block">Risk</label>
                            <div className="flex bg-[#1a1d2e] p-0.5 rounded">
                                {['low', 'medium', 'high'].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setRisk(r as any)}
                                        className={`flex-1 py-1 rounded text-[8px] font-black uppercase transition-all ${risk === r ? 'bg-neon1 text-black' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 w-full">
                            <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 block">Rows: {rows}</label>
                            <input 
                                type="range" min="8" max="16" step="1" 
                                value={rows} onChange={(e) => setRows(parseInt(e.target.value))}
                                className="w-full accent-neon1 cursor-pointer h-6"
                            />
                        </div>

                        <button 
                            onClick={handleDrop}
                            className="w-full sm:w-auto px-6 py-0 h-8 bg-pink-500 text-white font-black uppercase rounded hover:bg-pink-400 transition-all shadow-lg active:scale-95 text-[10px] tracking-wider"
                        >
                            Drop
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
