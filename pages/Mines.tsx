
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { GameService } from '../services/gameService';
import { playBombSound, playGemSound, playMineClick } from '../constants';

export const Mines: React.FC = () => {
    const navigate = useNavigate();
    const { user, login, balance, refreshBalance } = useAuth();

    const [wager, setWager] = useState<string>('100');
    const [mineCount, setMineCount] = useState(3);
    const [isPlaying, setIsPlaying] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [grid, setGrid] = useState<number[]>(Array(25).fill(0)); // 0=hidden, 1=gem, 2=mine
    const [mineLocations, setMineLocations] = useState<number[]>([]);
    const [revealedCount, setRevealedCount] = useState(0);

    // Calc Logic
    const getMultiplier = (mines: number, revealed: number) => {
        let mult = 1;
        for (let i = 0; i < revealed; i++) {
            mult *= (25 - i) / (25 - i - mines);
        }
        return mult;
    };

    const currentMultiplier = getMultiplier(mineCount, revealedCount);
    const nextMultiplier = getMultiplier(mineCount, revealedCount + 1);
    const potentialWin = Math.floor(parseInt(wager) * currentMultiplier);

    const startGame = async () => {
        if (!user) { login(); return; }
        const amount = parseInt(wager);
        if (isNaN(amount) || amount <= 0 || amount > balance) return;

        // Instant visual deduct
        refreshBalance(balance - amount);

        try {
            await GameService.arcadeDeduct(user.id, 'mines', amount);
            
            const locs = new Set<number>();
            while(locs.size < mineCount) {
                locs.add(Math.floor(Math.random() * 25));
            }
            setMineLocations(Array.from(locs));
            setGrid(Array(25).fill(0));
            setRevealedCount(0);
            setIsPlaying(true);
            setGameOver(false);
        } catch (e: any) {
            alert(e.message);
            refreshBalance(); // Revert
        }
    };

    const handleTileClick = (idx: number) => {
        if (!isPlaying || gameOver || grid[idx] !== 0) return;

        playMineClick();

        if (mineLocations.includes(idx)) {
            // BOOM
            playBombSound();
            const newGrid = [...grid];
            newGrid[idx] = 2; // Exploded
            mineLocations.forEach(m => newGrid[m] = 2);
            setGrid(newGrid);
            setGameOver(true);
            setIsPlaying(false);
        } else {
            // GEM
            playGemSound();
            const newGrid = [...grid];
            newGrid[idx] = 1;
            setGrid(newGrid);
            setRevealedCount(prev => prev + 1);
        }
    };

    const cashout = async () => {
        if (!isPlaying || gameOver) return;
        try {
            await GameService.arcadePayout(user.id, 'mines', potentialWin);
            refreshBalance(balance + potentialWin); // Win added
            setGameOver(true);
            setIsPlaying(false);
            
            const newGrid = [...grid];
            mineLocations.forEach(m => { if (newGrid[m] === 0) newGrid[m] = 3; }); 
            setGrid(newGrid);
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="container mx-auto p-4 max-w-5xl min-h-[85vh] flex flex-col items-center">
            <button onClick={() => navigate('/games')} className="self-start text-xs font-bold text-muted hover:text-white uppercase tracking-widest mb-8">← Back</button>

            <div className="flex flex-col lg:flex-row gap-8 w-full">
                {/* GAME GRID - NOW FIRST */}
                <div className="flex-1 flex justify-center items-start">
                    <div className="grid grid-cols-5 gap-3 bg-[#0e1020] p-4 rounded-3xl border border-[#2a2c45]">
                        {grid.map((cell, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleTileClick(idx)}
                                disabled={!isPlaying || cell !== 0}
                                className={`
                                    w-14 h-14 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center text-3xl transition-all shadow-inner border
                                    ${cell === 0 
                                        ? 'bg-[#1a1d2e] border-[#2a2c45] hover:bg-[#2a2c45]' 
                                        : cell === 1 
                                            ? 'bg-green-500/20 border-green-500/50 shadow-[inset_0_0_20px_rgba(34,197,94,0.2)]' 
                                            : 'bg-red-500/20 border-red-500/50 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)]'
                                    }
                                    ${isPlaying && cell === 0 ? 'cursor-pointer active:scale-95' : 'cursor-default'}
                                `}
                            >
                                {cell === 1 && '💎'}
                                {cell === 2 && '💣'}
                                {cell === 3 && <span className="opacity-50 grayscale">💣</span>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* CONTROLS - NOW SECOND - COMPACT */}
                <div className="bg-[#0e1020] border border-[#2a2c45] p-4 rounded-2xl w-full lg:w-56 shrink-0 h-fit">
                    <h2 className="text-lg font-black text-white uppercase italic tracking-tighter mb-4">Mines Config</h2>
                    
                    <div className="mb-4">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Wager</label>
                        <input 
                            type="number" 
                            disabled={isPlaying}
                            value={wager}
                            onChange={(e) => setWager(e.target.value)}
                            className="w-full bg-[#080a16] border border-[#2a2c45] rounded-lg p-2 text-white font-mono font-bold text-sm focus:border-neon1 outline-none disabled:opacity-50"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Mines: {mineCount}</label>
                        <input 
                            type="range" min="1" max="24" step="1" 
                            disabled={isPlaying}
                            value={mineCount} onChange={(e) => setMineCount(parseInt(e.target.value))}
                            className="w-full accent-red-500 cursor-pointer disabled:opacity-50"
                        />
                    </div>

                    {!isPlaying ? (
                        <button 
                            onClick={startGame}
                            className="w-full py-3 bg-neon1 text-black font-black uppercase rounded-lg hover:bg-white transition-all shadow-[0_0_20px_rgba(109,249,255,0.4)] active:scale-95 text-xs"
                        >
                            Start Game
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <div className="text-center bg-black/40 p-2 rounded-lg border border-white/5">
                                <div className="text-[9px] text-gray-500 uppercase font-bold">Current Win</div>
                                <div className="text-xl font-black text-green-400">{potentialWin.toLocaleString()}</div>
                                <div className="text-[9px] text-gray-600">({currentMultiplier.toFixed(2)}x)</div>
                            </div>
                            <button 
                                onClick={cashout}
                                className="w-full py-3 bg-green-500 text-black font-black uppercase rounded-lg hover:bg-green-400 transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)] active:scale-95 animate-pulse text-xs"
                            >
                                Cashout
                            </button>
                            <div className="text-center text-[9px] text-gray-500">
                                Next Tile: <span className="text-white font-bold">{nextMultiplier.toFixed(2)}x</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
