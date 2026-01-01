
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { GameService } from '../services/gameService';
import { BattleMode, BattleRule, BattleResult, SpinResult, BoxItem, BoxInfo, BattleRoll } from '../types';
import { SlotReel } from '../components/SlotReel';
import { JackpotWheel } from '../components/JackpotWheel';
import { getItemIcon, getItemImageUrl, RULE_ICONS, TIER_COLORS, getBoxImageUrl, BATTLE_EMOTES } from '../constants';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';

const TEAM_COLORS: Record<number, { name: string, bg: string, border: string, text: string, neon: string, hex: string }> = {
    0: { name: 'TEAM A', bg: 'bg-neon1/10', border: 'border-neon1', text: 'text-white', neon: 'text-neon1', hex: '#6df9ff' }, // Cyan
    1: { name: 'TEAM B', bg: 'bg-red-500/10', border: 'border-red-500', text: 'text-red-100', neon: 'text-red-500', hex: '#ef4444' }, // Red
    2: { name: 'TEAM C', bg: 'bg-green-500/10', border: 'border-green-500', text: 'text-green-100', neon: 'text-green-400', hex: '#22c55e' }, // Green
    3: { name: 'TEAM D', bg: 'bg-purple-500/10', border: 'border-purple-500', text: 'text-purple-100', neon: 'text-purple-400', hex: '#a855f7' }, // Purple
    4: { name: 'TEAM E', bg: 'bg-orange-500/10', border: 'border-orange-500', text: 'text-orange-100', neon: 'text-orange-400', hex: '#f97316' }, // Orange
    5: { name: 'TEAM F', bg: 'bg-pink-500/10', border: 'border-pink-500', text: 'text-pink-100', neon: 'text-pink-400', hex: '#ec4899' }, // Pink
};

export const BattleReplay: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // Data
    const [replayData, setReplayData] = useState<{ result: BattleResult, boxes: string[], mode: BattleMode, rule: BattleRule, jackpot: boolean } | null>(null);
    const [allBoxInfos, setAllBoxInfos] = useState<BoxInfo[]>([]);
    const [loading, setLoading] = useState(true);

    // State
    const [currentRoundIndex, setCurrentRoundIndex] = useState(-1);
    const [roundStatus, setRoundStatus] = useState<'idle' | 'spinning' | 'finished'>('idle');
    const [playerScores, setPlayerScores] = useState<number[]>([]);
    const [currentPot, setCurrentPot] = useState(0); 
    const [allReelsFinished, setAllReelsFinished] = useState(false);
    
    const [roundResults, setRoundResults] = useState<(SpinResult | null)[]>([]);
    const [activePool, setActivePool] = useState<BoxItem[]>([]);
    const [processingRound, setProcessingRound] = useState(false);
    const [finishedReels, setFinishedReels] = useState<Set<number>>(new Set());

    // Tiebreaker & Jackpot
    const [showTiebreaker, setShowTiebreaker] = useState(false);
    const [tiebreakerWinner, setTiebreakerWinner] = useState<number | null>(null);
    const [tiebreakerSpinning, setTiebreakerSpinning] = useState(false);
    const [tiebreakerResult, setTiebreakerResult] = useState<SpinResult | null>(null);

    const [jackpotStatus, setJackpotStatus] = useState<'idle' | 'spinning' | 'completed'>('idle');
    const [jackpotSegments, setJackpotSegments] = useState<any[]>([]);
    const [jackpotWinner, setJackpotWinner] = useState<number | null>(null);

    // Emotes
    const [activeEmotes, setActiveEmotes] = useState<Record<number, string>>({});
    const [showEmoteMenu, setShowEmoteMenu] = useState(false);

    const reelsFinishedCount = useRef(0);
    const mounted = useRef(true);

    // Determine current user's player index
    const myPlayerIndex = useMemo(() => {
        if (!user || !replayData?.result?.rounds?.[0]) return -1;
        const roll = replayData.result.rounds[0].rolls.find(r => r.user_id === user.id);
        return roll ? roll.player_index : -1;
    }, [user, replayData]);

    // Calculate display order for replays (same logic as BattleRoom)
    const displayIndices = useMemo<number[]>(() => {
        if (!replayData?.result) return [];
        const count = replayData.result.player_teams.length;
        const indices = Array.from({ length: count }, (_, i) => i);
        
        // Sort indices by their Team ID in the result
        return indices.sort((a, b) => {
            const teamA = replayData.result.player_teams[a];
            const teamB = replayData.result.player_teams[b];
            if (teamA !== teamB) return teamA - teamB;
            return a - b;
        });
    }, [replayData]);

    // Setup Realtime Emotes
    useEffect(() => {
        if (!id) return;
        const channel = supabase.channel(`battle_room_${id}`);
        
        channel.on('broadcast', { event: 'emote' }, (payload: any) => {
             // Explicitly cast payload to avoid 'unknown' index type error
             const { playerIndex, emoteId } = payload.payload as { playerIndex: number, emoteId: string };
             const emote = BATTLE_EMOTES.find(e => e.id === emoteId);
             if (emote) {
                 setActiveEmotes(prev => ({ ...prev, [playerIndex]: emote.icon }));
                 setTimeout(() => {
                     setActiveEmotes(prev => {
                         const next = { ...prev };
                         if (next[playerIndex] === emote.icon) delete next[playerIndex];
                         return next;
                     });
                 }, 3000);
             }
        }).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [id]);

    const handleSendEmote = (emoteId: string) => {
        if (myPlayerIndex === -1) return;
        const emote = BATTLE_EMOTES.find(e => e.id === emoteId);
        if (!emote) return;

        // Local Instant Update
        setActiveEmotes(prev => ({ ...prev, [myPlayerIndex]: emote.icon }));
        setTimeout(() => {
            setActiveEmotes(prev => {
                const next = { ...prev };
                if (next[myPlayerIndex] === emote.icon) delete next[myPlayerIndex];
                return next;
            });
        }, 3000);

        // Broadcast
        supabase.channel(`battle_room_${id}`).send({
            type: 'broadcast',
            event: 'emote',
            payload: { playerIndex: myPlayerIndex, emoteId }
        });
        setShowEmoteMenu(false);
    };

    useEffect(() => {
        mounted.current = true;
        // Fetch visuals
        GameService.getBoxes().then(data => {
            if (mounted.current) setAllBoxInfos(data);
        });

        if (id) {
            GameService.getBattleResult(Number(id))
                .then(data => {
                    if (mounted.current) {
                        setReplayData({
                            result: data.result,
                            boxes: data.boxes,
                            mode: data.mode,
                            rule: data.rule,
                            jackpot: data.jackpot_enabled
                        });
                        setPlayerScores(new Array(data.result.player_teams.length).fill(0));
                        setCurrentPot(0);
                        setLoading(false);

                        // --- UNLOCK CHECK ---
                        if (user && data.result) {
                            GameService.checkAndUnlockBattleItems(user.id, data.result.battle_id);
                        }

                        setTimeout(() => setCurrentRoundIndex(0), 1500);
                    }
                })
                .catch(() => navigate('/battle'));
        }
        return () => { mounted.current = false; };
    }, [id, navigate, user]);

    // MAIN REPLAY LOOP
    useEffect(() => {
        if (!replayData || currentRoundIndex < 0) return;
        const { result, boxes } = replayData;

        if (currentRoundIndex >= boxes.length) {
            // JACKPOT PHASE CHECK
            if (replayData.jackpot) {
                if (jackpotStatus === 'idle') {
                    startJackpotPhase();
                    return;
                }
                if (jackpotStatus === 'spinning') return;
                setRoundStatus('finished');
                return;
            }

            if (result.is_draw && !tiebreakerWinner) {
                setShowTiebreaker(true);
            } else {
                setRoundStatus('finished');
            }
            return;
        }

        const playRound = async () => {
            if (processingRound) return;
            setProcessingRound(true);
            setRoundStatus('idle');
            setAllReelsFinished(false);

            const boxName = boxes[currentRoundIndex];
            const allBoxes = await GameService.getBoxes();
            const boxInfo = allBoxes.find(b => b.name === boxName);
            let currentPoolItems: BoxItem[] = [];

            if (boxInfo) {
                const items = await GameService.getBoxItems(boxInfo.box_id);
                if (mounted.current) {
                    setActivePool(items);
                    currentPoolItems = items;
                }
            }

            // --- SAFETY CHECK ---
            const roundData = result.rounds[currentRoundIndex];
            if (!roundData) {
                console.warn(`Round Data Missing for Index ${currentRoundIndex}`);
                setRoundStatus('finished');
                return;
            }

            const nextResults = roundData.rolls.map(roll => {
                const originalItem = currentPoolItems.find(i => i.name === roll.item_name);
                const itemImage = originalItem?.image ? getItemImageUrl(originalItem.image) : '';
                
                return {
                    payout: roll.item_value,
                    tier: roll.tier,
                    item_name: roll.item_name,
                    item_icon: itemImage,
                    is_golden: false
                };
            });

            if (mounted.current) {
                setRoundResults(new Array(result.player_teams.length).fill(null));
                setFinishedReels(new Set());
                reelsFinishedCount.current = 0;
                setRoundStatus('spinning');
                setTimeout(() => {
                     if (mounted.current) setRoundResults(nextResults);
                }, 500);
            }
        };

        playRound();
    }, [currentRoundIndex, replayData, jackpotStatus]);

    // --- JACKPOT LOGIC ---
    const startJackpotPhase = () => {
        if (!replayData) return;
        setJackpotStatus('spinning');

        // Calculate Weights for the Wheel
        const rawWeights: number[] = new Array(playerScores.length).fill(0);

        if (replayData.rule === 'terminal') {
            const lastRound = replayData.result.rounds[replayData.result.rounds.length - 1];
            if (lastRound) {
                lastRound.rolls.forEach(r => {
                    if (r.player_index < rawWeights.length) rawWeights[r.player_index] += r.item_value;
                });
            }
        } else if (replayData.rule === 'less') {
             const inverseWeights = playerScores.map(s => 1 / Math.max(s, 1));
             inverseWeights.forEach((w, i) => rawWeights[i] = w);
        } else {
            playerScores.forEach((s, i) => rawWeights[i] = s);
        }

         if (rawWeights.every(w => w === 0)) rawWeights.fill(1);

        const teamMap = new Map<number, number>();
        // Fix: Use for loop to avoid index type inference issues with forEach in strict mode
        for (let i = 0; i < replayData.result.player_teams.length; i++) {
            const teamId = replayData.result.player_teams[i];
            const current = teamMap.get(teamId) || 0;
            teamMap.set(teamId, current + (rawWeights[i] || 0));
        }

        const segments = Array.from(teamMap.entries()).map(([teamId, weight]) => {
            const tId = teamId as number;
            const config = TEAM_COLORS[tId];
            return {
                id: tId,
                label: config.name,
                weight: weight as number,
                color: config.hex,
                textColor: '#fff'
            };
        });

        setJackpotSegments(segments);

        let winId = replayData.result.winner_team_id;
        if (replayData.result.is_draw) {
             const uniqueTeams = Array.from(new Set(replayData.result.player_teams));
             winId = uniqueTeams[Math.floor(Math.random() * uniqueTeams.length)];
        }
        setJackpotWinner(winId);
    };

    const handleJackpotComplete = () => {
        setTimeout(() => {
            setJackpotStatus('completed');
        }, 2000);
    };

    const handleReelFinished = (playerIdx: number) => {
        setFinishedReels(prev => {
            const next = new Set(prev);
            next.add(playerIdx);
            return next;
        });

        reelsFinishedCount.current += 1;
        const numPlayers = replayData?.result.player_teams.length || 0;
        if (reelsFinishedCount.current >= numPlayers) {
            updateScores();
            setAllReelsFinished(true);
            const isLastRound = replayData ? currentRoundIndex === replayData.boxes.length - 1 : false;
            const delay = isLastRound ? 2000 : 1000;
            setTimeout(advanceRound, delay);
        }
    };

    const updateScores = () => {
        if (!replayData) return;
        const roundData = replayData.result.rounds[currentRoundIndex];
        // Safety check again inside helper
        if (!roundData) return; 

        const isWhale = replayData.rule === 'whale';
        
        const roundTotal = roundData.rolls.reduce((acc: number, r: BattleRoll) => acc + r.item_value, 0);
        setCurrentPot(prev => prev + roundTotal);

        setPlayerScores((prev: number[]) => {
            const next = [...prev];
            roundData.rolls.forEach((r: BattleRoll) => {
                const pIdx = r.player_index;
                if (typeof pIdx === 'number' && pIdx < next.length) {
                    if (isWhale) {
                         next[pIdx] = Math.max(next[pIdx], r.item_value);
                    } else {
                         next[pIdx] += r.item_value;
                    }
                }
            });
            return next;
        });
    };

    const advanceRound = () => {
        setProcessingRound(false);
        setCurrentRoundIndex(i => i + 1);
    };

    // TIEBREAKER
    useEffect(() => {
        if (showTiebreaker && !tiebreakerSpinning && !tiebreakerResult && replayData) {
            const teams = Array.from(new Set(replayData.result.player_teams));
            const randomWinnerTeam = teams[Math.floor(Math.random() * teams.length)] as number;
            const winnerConfig = TEAM_COLORS[randomWinnerTeam];
            
            setTiebreakerSpinning(true);
            setTimeout(() => {
                setTiebreakerResult({ payout: 0, tier: 'gold', item_name: winnerConfig.name, item_icon: '🏆', is_golden: true });
                setTiebreakerWinner(randomWinnerTeam);
            }, 500);
        }
    }, [showTiebreaker, replayData]);

    const handleTiebreakerComplete = () => {
        setTimeout(() => {
            setShowTiebreaker(false);
            setRoundStatus('finished');
        }, 3000);
    };

    if (loading) return <div className="p-20 text-center animate-pulse text-neon1">Syncing Archive...</div>;

    const { result, rule, boxes } = replayData!;
    const numPlayers = result.player_teams.length;
    const isWhale = rule === 'whale';
    const isTerminal = rule === 'terminal';
    const isLess = rule === 'less';

    const winnerTeamId = (tiebreakerWinner !== null) ? tiebreakerWinner : (jackpotWinner !== null) ? jackpotWinner : result.winner_team_id;
    const isFinished = roundStatus === 'finished';

    const tiebreakerPool: BoxItem[] = replayData ? Array.from(new Set(replayData.result.player_teams)).map((tIdx: number) => ({
         name: TEAM_COLORS[tIdx].name, tier: 'gold', value: 0, image: '🏆', weight: 100 
    })) : [];

    let userPayout = 0;
    let userTeamIndex = -1;
    let userOutcomeTitle = '';
    let userOutcomeColor = '';

    if (isFinished && user) {
        // Need safety check here too if rounds[0] is missing
        const firstRound = result.rounds[0];
        const userRoll = firstRound?.rolls.find((r: any) => r.user_id === user.id);
        
        if (userRoll) {
            userTeamIndex = result.player_teams[userRoll.player_index];
            const isDraw = result.is_draw && !tiebreakerWinner; 
            
             if (isDraw && !jackpotWinner) {
                userPayout = Math.floor((result.total_pot || 0) / numPlayers);
                userOutcomeTitle = "Draw - Refunded";
                userOutcomeColor = "text-white";
            } else if (userTeamIndex === winnerTeamId) {
                 const winnersCount = result.player_teams.filter(t => t === winnerTeamId).length;
                 userPayout = Math.floor((result.total_pot || 0) / (winnersCount || 1));
                 userOutcomeTitle = "Victory";
                 userOutcomeColor = "text-neon1";
            } else {
                 userPayout = 0;
                 userOutcomeTitle = "Defeat";
                 userOutcomeColor = "text-red-500";
            }
        }
    }

    // HUD Logic
    const currentBoxName = boxes[currentRoundIndex] || null;
    const nextBoxName = boxes[currentRoundIndex + 1] || null;
    const currentBoxInfo = allBoxInfos.find(b => b.name === currentBoxName);
    const nextBoxInfo = allBoxInfos.find(b => b.name === nextBoxName);

    const displayPot = currentPot;
    const potLabel = 'Current Pot';

    let EndScreen = null;
    if (isFinished) {
        let title = "";
        let color = "";
        let totalPot = result.total_pot || 0;

        if (user && userTeamIndex !== -1) {
            title = userOutcomeTitle;
            color = userOutcomeColor;
        } else {
            const winTeam = winnerTeamId ?? 0;
            title = `Team ${String.fromCharCode(65 + winTeam)} Wins`;
            color = TEAM_COLORS[winTeam]?.neon || "text-white";
        }

        EndScreen = (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-[#0e1020] border-2 border-neon1 p-12 rounded-3xl text-center max-w-md w-full shadow-[0_0_150px_rgba(109,249,255,0.2)]">
                    <h2 className={`text-5xl font-black uppercase mb-8 italic tracking-tighter ${color}`}>{title}</h2>
                    <div className="bg-white/5 rounded-2xl p-6 mb-6 border border-white/5">
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total Payout</div>
                        <div className="text-3xl font-black text-white italic">{totalPot.toLocaleString()} GP</div>
                    </div>
                     {userTeamIndex !== -1 && (
                        <div className={`rounded-2xl p-6 mb-10 border ${userPayout > 0 ? 'bg-neon1/10 border-neon1/30' : 'bg-red-500/10 border-red-500/30'}`}>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Your Payout</div>
                            <div className={`text-4xl font-black italic ${userPayout > 0 ? 'text-neon1' : 'text-gray-500'}`}>
                                {userPayout > 0 ? '+' : ''}{userPayout.toLocaleString()} GP
                            </div>
                        </div>
                    )}
                    <button onClick={() => navigate('/battle')} className="w-full py-4 bg-white text-black font-black uppercase text-xs rounded-xl hover:scale-105 transition-all">Back to Battles</button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-2 sm:p-4 max-w-[95vw] 2xl:max-w-[1800px] flex flex-col h-[90vh] overflow-hidden justify-between animate-fade-in relative">
             
             {/* --- TOP HUD --- */}
             <div className="flex justify-between items-start shrink-0 p-2 z-20">
                <div className="bg-[#0e1020]/90 backdrop-blur border border-[#2a2c45] p-3 rounded-2xl shadow-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-neon1/10 border border-neon1/20 flex items-center justify-center text-xl">
                        {RULE_ICONS[rule] || '⚔️'}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                             <div className="text-[10px] bg-white/10 px-1.5 rounded text-white font-bold uppercase">Replay</div>
                             <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">ID: {id}</div>
                        </div>
                        <h1 className="text-sm font-black text-white italic uppercase tracking-wider">
                             {rule} • {replayData?.mode}
                             {replayData?.jackpot && <span className="text-yellow-400 ml-2">✦ JACKPOT</span>}
                        </h1>
                    </div>
                </div>

                <div className="bg-[#0e1020]/90 backdrop-blur border border-[#2a2c45] p-3 rounded-2xl shadow-xl text-right min-w-[100px]">
                    <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Round</div>
                    <div className="text-xl font-black text-white leading-none">{currentRoundIndex + 1}<span className="text-gray-600 text-xs">/{boxes.length}</span></div>
                </div>
            </div>

            {/* --- MIDDLE GRID --- */}
            {/* Added lg:grid-cols-4 and xl:grid-cols-6 to support wider layouts */}
            <div className={`flex-1 grid grid-cols-2 lg:grid-cols-${Math.min(numPlayers, 4)} xl:grid-cols-${Math.min(numPlayers, 6)} gap-2 md:gap-4 items-center p-1 relative z-30`}>
                {displayIndices.map((idx: number) => {
                    const teamId = result.player_teams[idx] ?? (idx % 2); 
                    const tConfig = TEAM_COLORS[teamId as number] || TEAM_COLORS[0];
                    const isWinner = isFinished && teamId === winnerTeamId;
                    const roundResult = roundResults[idx];

                    let jackpotPercentDisplay = null;
                    if (replayData?.jackpot) {
                        let odds = 0;
                        const totalPlayers = numPlayers;

                        if (isTerminal) {
                             const isLastRound = currentRoundIndex === boxes.length - 1;
                             if (isLastRound && allReelsFinished) {
                                 const currentRoundValues = roundResults.map(r => r?.payout || 0);
                                 const roundTotal = currentRoundValues.reduce((a,b) => a+b, 0);
                                 if (roundTotal > 0) {
                                     const myVal = roundResults[idx]?.payout || 0;
                                     odds = (myVal / roundTotal) * 100;
                                 } else {
                                     odds = 100 / totalPlayers;
                                 }
                                 jackpotPercentDisplay = odds.toFixed(1) + '%';
                             }
                        } else if (isLess) {
                            const allZero = playerScores.every(s => s === 0);
                            if (allZero) {
                                odds = 100 / totalPlayers;
                            } else {
                                const weights = playerScores.map(s => 1 / Math.max(s, 1));
                                const totalWeight = weights.reduce((a,b) => a+b, 0);
                                odds = (weights[idx] / totalWeight) * 100;
                            }
                            jackpotPercentDisplay = odds.toFixed(1) + '%';
                        } else {
                            const totalScore = playerScores.reduce((a,b) => a+b, 0);
                            if (totalScore > 0) {
                                odds = (playerScores[idx] / totalScore) * 100;
                            } else {
                                odds = 100 / totalPlayers;
                            }
                            jackpotPercentDisplay = odds.toFixed(1) + '%';
                        }
                    }

                    return (
                        <div key={idx} className={`flex flex-col h-full max-h-[500px] transition-all duration-700 ${isWinner ? 'scale-105 z-20' : 'scale-100 opacity-80'} relative`}>
                            {/* EMOTE BUBBLE - HIGH Z-INDEX */}
                            {activeEmotes[idx] && (
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-[100] animate-bounce-in drop-shadow-2xl pointer-events-none">
                                    <div className="bg-white text-black text-2xl px-4 py-2 rounded-2xl relative shadow-[0_0_20px_rgba(0,0,0,0.5)] font-black border-2 border-black flex items-center justify-center min-w-[60px] min-h-[45px]">
                                        {activeEmotes[idx]}
                                        <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r-2 border-b-2 border-black rotate-45"></div>
                                    </div>
                                </div>
                            )}
                            
                             <div className={`text-center py-1 px-2 rounded-t-xl font-black text-[9px] uppercase tracking-[0.2em] border-t border-x ${tConfig.bg} ${tConfig.border} ${tConfig.neon} truncate`}>
                                {tConfig.name} • AGENT {idx + 1}
                            </div>
                            
                            <div className={`flex-1 bg-[#0e1020] border-x border-b rounded-b-xl relative overflow-hidden shadow-2xl flex items-center justify-center ${tConfig.border} ${isWinner ? 'border-yellow-400 ring-2 ring-yellow-400/20' : ''}`}>
                                    <SlotReel 
                                        key={currentRoundIndex} // Key to force reset on round change
                                        spinning={roundStatus === 'spinning' && !roundResult} 
                                        result={roundResult} 
                                        pool={activePool} 
                                        isVertical={true} 
                                        onStop={() => handleReelFinished(idx)}
                                        compact={numPlayers > 4}
                                    />
                                {isWinner && <div className="absolute inset-0 bg-yellow-400/10 animate-pulse-glow z-10 pointer-events-none"></div>}
                            </div>
                            
                            <div className="mt-1 text-center bg-[#1a1d2e] rounded-xl py-1 px-2 border border-white/5 shadow-lg flex justify-between items-center relative overflow-hidden">
                                <div className="text-[8px] text-gray-600 font-bold uppercase tracking-widest opacity-50 relative z-10">
                                    {isWhale ? 'Best' : 'Total'}
                                </div>
                                {jackpotPercentDisplay && (
                                    <div className="absolute inset-x-0 bottom-0 top-0 flex items-center justify-center pointer-events-none opacity-10">
                                         <div className="h-full bg-yellow-400" style={{ width: jackpotPercentDisplay }}></div>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 relative z-10">
                                     {jackpotPercentDisplay && (
                                        <div className="bg-yellow-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">
                                            {jackpotPercentDisplay}
                                        </div>
                                     )}
                                    <div className={`text-sm font-black italic tracking-tighter ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
                                        {(playerScores[idx] || 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

             {/* --- BOTTOM HUD & EMOTE MENU --- */}
             <div className="flex justify-between items-end shrink-0 p-2 z-40 relative">
                <div className="flex flex-col gap-2">
                    {/* EMOTE MENU - BOTTOM LEFT */}
                    {myPlayerIndex !== -1 && !isFinished && (
                        <div className="relative">
                            {showEmoteMenu && (
                                <div className="absolute bottom-full left-0 mb-2 bg-[#0e1020]/95 backdrop-blur border border-white/10 p-2 rounded-xl shadow-2xl animate-slide-in-up flex flex-col-reverse gap-2 z-[60]">
                                    {BATTLE_EMOTES.map(emote => (
                                        <button
                                            key={emote.id}
                                            onClick={() => handleSendEmote(emote.id)}
                                            className="w-10 h-10 bg-white/5 hover:bg-white/20 rounded-full flex items-center justify-center text-xl transition-all hover:scale-110 active:scale-95 border border-transparent hover:border-neon1"
                                            title={emote.label}
                                        >
                                            {emote.icon}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button 
                                onClick={() => setShowEmoteMenu(!showEmoteMenu)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all shadow-lg border ${showEmoteMenu ? 'bg-neon1 text-black border-neon1' : 'bg-[#0e1020] text-gray-400 border-[#2a2c45] hover:text-white'}`}
                            >
                                {showEmoteMenu ? '✕' : '💬'}
                            </button>
                        </div>
                    )}

                    {/* Timeline */}
                    <div className="min-w-[120px]">
                        {currentBoxInfo && (
                            <div className="flex items-center gap-2 bg-[#0e1020]/90 backdrop-blur px-3 py-2 rounded-2xl border border-[#2a2c45] shadow-xl">
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 relative">
                                        <img src={getBoxImageUrl(currentBoxInfo.image)} alt="Current" className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
                                    </div>
                                </div>
                                <div className="text-gray-600 text-lg">›</div>
                                <div className="flex flex-col items-center opacity-40">
                                    <div className="w-6 h-6 relative">
                                        {nextBoxInfo ? (
                                            <img src={getBoxImageUrl(nextBoxInfo.image)} alt="Next" className="w-full h-full object-contain grayscale" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs">🏁</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pot */}
                <div className="px-6 py-3 bg-[#0e1020]/90 backdrop-blur rounded-2xl border border-[#2a2c45] text-right shadow-xl min-w-[140px]">
                    <div className="text-[9px] text-muted font-bold uppercase tracking-widest mb-0.5">{potLabel}</div>
                    <div className="text-xl font-black text-neon1 italic">{displayPot.toLocaleString()}</div>
                </div>
            </div>

            {/* JACKPOT MODAL */}
            {jackpotStatus === 'spinning' && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-fade-in">
                    <div className="w-full max-w-lg bg-[#0e1020] border-4 border-yellow-400 rounded-3xl p-8 flex flex-col items-center shadow-[0_0_100px_rgba(250,204,21,0.4)]">
                        <h2 className="text-4xl font-black text-yellow-400 italic uppercase tracking-tighter mb-2 animate-pulse">JACKPOT DRAW</h2>
                        <div className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-widest">Outcome Determined by Odds</div>
                        <JackpotWheel segments={jackpotSegments} winnerId={jackpotWinner ?? 0} onComplete={handleJackpotComplete} />
                    </div>
                </div>
            )}

            {/* Tiebreaker */}
            {showTiebreaker && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-fade-in">
                    <div className="w-full max-w-md bg-[#0e1020] border-4 border-red-500 rounded-3xl p-8 flex flex-col items-center shadow-[0_0_100px_rgba(239,68,68,0.4)]">
                        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-2">SUDDEN DEATH</h2>
                        <div className="w-64 h-64 bg-[#1a1d2e] border-2 border-red-500 rounded-full relative overflow-hidden shadow-2xl mb-8 flex items-center justify-center">
                            <SlotReel spinning={tiebreakerSpinning && !tiebreakerResult} result={tiebreakerResult} pool={tiebreakerPool} isVertical={true} onStop={handleTiebreakerComplete} disableTease={true} />
                        </div>
                    </div>
                </div>
            )}
            
            {EndScreen}
        </div>
    );
};
