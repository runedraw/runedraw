
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { GameService } from '../services/gameService';
import { playGemSound, playMineClick, playSkullSound } from '../constants';

export const Tower: React.FC = () => {
    const navigate = useNavigate();
    const { user, login, balance, refreshBalance } = useAuth();

    const [wager, setWager] = useState<string>('100');
    // Set default difficulty to 'easy'
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentRow, setCurrentRow] = useState(0); // 0 = bottom
    const [gameOver, setGameOver] = useState(false);
    const [rowResults, setRowResults] = useState<number[][]>([]); 

    const TOTAL_ROWS = 8;
    const minesPerRow = difficulty === 'easy' ? 1 : 2;
    const safePerRow = 3 - minesPerRow;
    
    const getRowMultiplier = (rowIdx: number) => {
        const rowWinChance = safePerRow / 3;
        const houseEdge = 0.98;
        const totalMult = Math.pow(1 / rowWinChance, rowIdx + 1) * houseEdge;
        return totalMult;
    };

    const currentMultiplier = currentRow > 0 ? getRowMultiplier(currentRow - 1) : 1;
    const potentialWin = Math.floor(parseInt(wager) * currentMultiplier);

    const startGame = async () => {
        if (!user) { login(); return; }
        const amount = parseInt(wager);
        if (isNaN(amount) || amount <= 0 || amount > balance) return;

        // Instant visual deduct
        refreshBalance(balance - amount);

        try {
            await GameService.arcadeDeduct(user.id, 'tower', amount);
            
            setIsPlaying(true);
            setCurrentRow(0);
            setGameOver(false);
            setRowResults(Array(TOTAL_ROWS).fill(Array(3).fill(0)));
        } catch (e: any) { 
            alert(e.message); 
            refreshBalance(); // Revert
        }
    };

    const handleSelect = (colIdx: number) => {
        if (!isPlaying || gameOver) return;

        playMineClick();

        const isSafe = Math.random() > (minesPerRow / 3);
        const newRowResults = [...rowResults];
        const currentRowArr = [...newRowResults[currentRow]]; 
        
        if (!isSafe) {
            // DEATH
            playSkullSound();
            currentRowArr[colIdx] = 2;
            newRowResults[currentRow] = currentRowArr;
            setRowResults(newRowResults);
            setGameOver(true);
            setIsPlaying(false);
        } else {
            // SAFE
            playGemSound();
            currentRowArr[colIdx] = 1;
            newRowResults[currentRow] = currentRowArr;
            setRowResults(newRowResults);
            
            if (currentRow === TOTAL_ROWS - 1) {
                cashout(true);
            } else {
                setCurrentRow(prev => prev + 1);
            }
        }
    };

    const cashout = async (auto = false) => {
        if ((!isPlaying && !auto) || gameOver) return;
        const winVal = auto ? Math.floor(parseInt(wager) * getRowMultiplier(TOTAL_ROWS - 1)) : potentialWin;

        try {
            await GameService.arcadePayout(user.id, 'tower', winVal);
            refreshBalance(balance + winVal);
            setGameOver(true);
            setIsPlaying(false);
        } catch (e: any) { alert(e.message); }
    };

    return (
        <div className="container mx-auto p-4 max-w-5xl min-h-[85vh] flex flex-col items-center">
            <button onClick={() => navigate('/games')} className="self-start text-xs font-bold text-muted hover:text-white uppercase tracking-widest mb-8">← Back</button>

            <div className="flex flex-col lg:flex-row gap-8 w-full">
                
                {/* TOWER GRID - NOW FIRST */}
                <div className="flex-1 bg-[#0e1020] border border-[#2a2c45] rounded-3xl p-6 lg:p-8 flex items-center justify-center relative">
                    {!isPlaying && !gameOver && <div className="absolute inset-0 bg-black/50 z-10 rounded-3xl flex items-center justify-center backdrop-blur-sm"><span className="text-2xl font-black text-white uppercase tracking-widest">Ready to Climb?</span></div>}

                    <div className="w-full max-w-md">
                        {Array.from({ length: TOTAL_ROWS }).slice().reverse().map((_, revIdx) => {
                            const rIdx = TOTAL_ROWS - 1 - revIdx; // Map reverse index back to logical row index
                            const isCurrent = currentRow === rIdx && isPlaying;
                            const isPast = currentRow > rIdx;
                            
                            return (
                                <div 
                                    key={rIdx} 
                                    className={`
                                        flex items-center w-full mb-2 p-2 rounded-xl transition-all relative
                                        ${isCurrent ? 'bg-neon1/10 border border-neon1/50 shadow-[0_0_15px_rgba(109,249,255,0.1)]' : 'border border-transparent opacity-50'}
                                    `}
                                >
                                    {/* Tiles */}
                                    <div className="flex-1 flex gap-3 justify-center mr-16">
                                        {Array.from({ length: 3 }).map((_, cIdx) => {
                                            const status = rowResults[rIdx] ? rowResults[rIdx][cIdx] : 0; 
                                            return (
                                                <button
                                                    key={cIdx}
                                                    disabled={!isPlaying || currentRow !== rIdx}
                                                    onClick={() => handleSelect(cIdx)}
                                                    className={`
                                                        w-16 h-12 rounded-lg font-bold text-xl transition-all flex items-center justify-center
                                                        ${status === 0 
                                                            ? (isCurrent ? 'bg-[#2a2c45] hover:bg-white hover:text-black cursor-pointer' : 'bg-[#1a1d2e]') 
                                                            : status === 1 ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 text-black'
                                                        }
                                                    `}
                                                >
                                                    {status === 1 ? '🪜' : status === 2 ? '💀' : ''}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Multiplier - Absolute Right */}
                                    <div className={`absolute right-4 text-xs font-mono font-bold pointer-events-none ${isCurrent ? 'text-white scale-110' : 'text-gray-600'}`}>
                                        {getRowMultiplier(rIdx).toFixed(2)}x
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* CONTROLS - NOW SECOND & COMPACT */}
                <div className="bg-[#0e1020] border border-[#2a2c45] p-4 rounded-2xl w-full lg:w-56 shrink-0 h-fit">
                    <h2 className="text-lg font-black text-white uppercase italic tracking-tighter mb-4">Config</h2>
                    
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
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Difficulty</label>
                        <div className="flex bg-[#1a1d2e] p-1 rounded-lg">
                            <button onClick={() => setDifficulty('easy')} disabled={isPlaying} className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded ${difficulty === 'easy' ? 'bg-green-500 text-black' : 'text-gray-500'}`}>Easy</button>
                            <button onClick={() => setDifficulty('hard')} disabled={isPlaying} className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded ${difficulty === 'hard' ? 'bg-red-500 text-white' : 'text-gray-500'}`}>Hard</button>
                        </div>
                        <p className="text-[8px] text-gray-500 mt-1 text-center">{difficulty === 'easy' ? '1 Mine / Row' : '2 Mines / Row'}</p>
                    </div>

                    {!isPlaying ? (
                        <button 
                            onClick={startGame}
                            className="w-full py-3 bg-neon1 text-black font-black uppercase rounded-lg hover:bg-white transition-all shadow-[0_0_20px_rgba(109,249,255,0.4)] active:scale-95 text-xs"
                        >
                            Start Climb
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <div className="text-center bg-black/40 p-2 rounded-lg border border-white/5">
                                <div className="text-[9px] text-gray-500 uppercase font-bold">Pot Value</div>
                                <div className="text-xl font-black text-blue-400">{potentialWin.toLocaleString()}</div>
                            </div>
                            <button 
                                onClick={() => cashout()}
                                disabled={currentRow === 0}
                                className="w-full py-3 bg-green-500 text-black font-black uppercase rounded-lg hover:bg-green-400 transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                            >
                                Cashout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
