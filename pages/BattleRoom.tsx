
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GameService } from '../services/gameService';
import { BattleRoomData, BattleResult, SpinResult, BoxItem, BoxInfo, BattleRoll } from '../types';
import { useAuth } from '../App';
import { SlotReel } from '../components/SlotReel';
import { JackpotWheel } from '../components/JackpotWheel';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { getItemIcon, getItemImageUrl, RULE_ICONS, getBoxImageUrl, TIER_COLORS, BATTLE_EMOTES } from '../constants';
import { supabase } from '../services/supabase';

const TEAM_COLORS: Record<number, { name: string, bg: string, border: string, text: string, neon: string, hex: string }> = {
    0: { name: 'TEAM A', bg: 'bg-neon1/10', border: 'border-neon1', text: 'text-white', neon: 'text-neon1', hex: '#6df9ff' }, // Cyan
    1: { name: 'TEAM B', bg: 'bg-red-500/10', border: 'border-red-500', text: 'text-red-100', neon: 'text-red-500', hex: '#ef4444' }, // Red
    2: { name: 'TEAM C', bg: 'bg-green-500/10', border: 'border-green-500', text: 'text-green-100', neon: 'text-green-400', hex: '#22c55e' }, // Green
    3: { name: 'TEAM D', bg: 'bg-purple-500/10', border: 'border-purple-500', text: 'text-purple-100', neon: 'text-purple-400', hex: '#a855f7' }, // Purple
    4: { name: 'TEAM E', bg: 'bg-orange-500/10', border: 'border-orange-500', text: 'text-orange-100', neon: 'text-orange-400', hex: '#f97316' }, // Orange
    5: { name: 'TEAM F', bg: 'bg-pink-500/10', border: 'border-pink-500', text: 'text-pink-100', neon: 'text-pink-400', hex: '#ec4899' }, // Pink
};

export const BattleRoom: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, login, balance, refreshBalance } = useAuth();
    
    // Core Data
    const [room, setRoom] = useState<BattleRoomData | null>(null);
    const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
    const [allBoxInfos, setAllBoxInfos] = useState<BoxInfo[]>([]);
    
    // Game State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentRoundIndex, setCurrentRoundIndex] = useState(-1);
    const [roundStatus, setRoundStatus] = useState<'idle' | 'spinning' | 'finished'>('idle');
    const [processingRound, setProcessingRound] = useState(false);
    const [allReelsFinished, setAllReelsFinished] = useState(false);
    
    // Scores
    const [playerScores, setPlayerScores] = useState<number[]>([]); 
    const [currentPot, setCurrentPot] = useState(0); 
    
    // Reel Data
    const [roundResults, setRoundResults] = useState<(SpinResult | null)[]>([]);
    const [activePool, setActivePool] = useState<BoxItem[]>([]);
    
    // Tiebreaker & Jackpot
    const [showTiebreaker, setShowTiebreaker] = useState(false);
    const [tiebreakerWinner, setTiebreakerWinner] = useState<number | null>(null);
    const [tiebreakerSpinning, setTiebreakerSpinning] = useState(false);
    const [tiebreakerResult, setTiebreakerResult] = useState<SpinResult | null>(null);

    // Jackpot State
    const [jackpotStatus, setJackpotStatus] = useState<'idle' | 'spinning' | 'completed'>('idle');
    const [jackpotSegments, setJackpotSegments] = useState<any[]>([]);
    const [jackpotWinner, setJackpotWinner] = useState<number | null>(null);

    // Actions
    const [isJoining, setIsJoining] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [isAddingBot, setIsAddingBot] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Emotes
    const [activeEmotes, setActiveEmotes] = useState<Record<number, string>>({});
    const [showEmoteMenu, setShowEmoteMenu] = useState(false);

    // Refs
    const reelsFinishedCount = useRef(0);
    const mounted = useRef(true);

    // Determine current user's player index
    const myPlayerIndex = useMemo(() => {
        if (!user || !room?.players) return -1;
        return room.players.findIndex(p => p.id === user.id);
    }, [user, room]);

    // Calculate display order to group teams together
    // Instead of interleaved (A, B, A, B), we want (A, A, B, B)
    const displayIndices = useMemo<number[]>(() => {
        if (!room) return [];
        const count = room.max_players;
        
        // Default indices [0, 1, 2, 3...]
        const indices = Array.from({ length: count }, (_, i) => i);
        
        // Sort indices by their Team ID
        // Note: For waiting/empty slots, we assume standard interleaving to determine expected team
        // Logic must match backend assignment: team_index usually is (index % team_count)
        let teamCount = 2;
        if (room.mode === '1v1v1') teamCount = 3;
        else if (room.mode === '1v1v1v1') teamCount = 4;
        else if (room.mode === '2v2v2') teamCount = 3;
        // 3v3 is 2 teams. 2v2 is 2 teams.
        
        return indices.sort((a, b) => {
            const teamA = room.players[a]?.team_index ?? (a % teamCount);
            const teamB = room.players[b]?.team_index ?? (b % teamCount);
            if (teamA !== teamB) return teamA - teamB;
            return a - b;
        });
    }, [room]);

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
        
        // Auto-close menu on select
        setShowEmoteMenu(false);
    };

    // --- 1. INITIALIZATION ---
    useEffect(() => {
        mounted.current = true;
        if (!id) return;

        // Fetch Boxes for visuals
        GameService.getBoxes().then(data => {
            if (mounted.current) setAllBoxInfos(data);
        });

        const init = async () => {
            try {
                const data = await GameService.getBattleRoom(Number(id));
                if (mounted.current && data) {
                    // Check if cancelled - using simple string check
                    if ((data.status as string) === 'cancelled') {
                        navigate('/battle');
                        return;
                    }
                    setRoom(data);
                    if (data.max_players) {
                        setPlayerScores(new Array(data.max_players).fill(0));
                    }
                    if (data.status === 'completed') {
                        navigate(`/battle/replay/${id}`, { state: { isLive: true } });
                    }
                }
            } catch (e) { 
                // If battle not found (deleted), navigate back
                navigate('/battle');
            }
        };
        init();

        const subscription = supabase
            .channel(`pending_battle_${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_battles', filter: `id=eq.${id}` }, (payload: any) => {
                if (!mounted.current) return;
                
                // If deleted (cancelled), redirect
                if (payload.eventType === 'DELETE') { 
                    navigate('/battle'); 
                    return; 
                }
                
                const newData = payload.new as BattleRoomData;
                if ((newData.status as any) === 'cancelled') { navigate('/battle'); return; }
                
                setRoom(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
                    return { ...prev, ...newData } as any;
                });

                if (newData.status === 'completed' && !isPlaying) {
                    navigate(`/battle/replay/${id}`, { state: { isLive: true } });
                }
            })
            .subscribe();

        return () => { 
            mounted.current = false;
            subscription.unsubscribe(); 
        };
    }, [id, navigate, isPlaying]);

    // --- 2. GAME SETUP & ACTIONS ---
    const handleJoin = async () => {
        if (!user) { login(); return; }
        if (!room) return;
        if (balance < room.cost_per_player) { alert("Insufficient credits!"); return; }
        setIsJoining(true);
        try {
            await GameService.joinBattle(room.id, user.id, user.email, room.cost_per_player);
            refreshBalance(balance - room.cost_per_player);
            const updated = await GameService.getBattleRoom(room.id);
            if (updated && mounted.current) setRoom(updated);
        } catch (e: any) { setError(e.message); } 
        finally { if (mounted.current) setIsJoining(false); }
    };

    const handleAddBot = async () => {
        if (!room) return;
        setIsAddingBot(true);
        try {
            await GameService.addBotToBattle(room.id);
            const updated = await GameService.getBattleRoom(room.id);
            if (updated && mounted.current) setRoom(updated);
        } catch (e: any) { alert(e.message); } 
        finally { if (mounted.current) setIsAddingBot(false); }
    };

    const handleCancelClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setShowCancelModal(true);
    };

    const confirmCancelBattle = async () => {
        if (!room) return;
        setIsCancelling(true);
        try {
            await GameService.cancelBattle(room.id);
            await refreshBalance();
            navigate('/battle');
        } catch (e: any) { 
            console.error("Cancel failed:", e);
            alert("Failed to cancel: " + e.message); 
            setIsCancelling(false); 
            setShowCancelModal(false);
        }
    };

    const startBattleSimulation = async () => {
        if (!room) return;
        setIsPlaying(true);
        setError(null);
        try {
            const result = await GameService.finalizeBattle(room.id);
            if (mounted.current) {
                setBattleResult(result);
                setPlayerScores(new Array(room.max_players).fill(0));
                setCurrentPot(0);
                setCurrentRoundIndex(0); 

                // TRIGGER ITEM UNLOCK
                if (user) {
                    setTimeout(() => {
                        GameService.checkAndUnlockBattleItems(user.id, room.id);
                    }, 500);
                }
            }
        } catch (e: any) {
            setError(e.message);
            setIsPlaying(false);
        }
    };

    // --- 3. GAME LOOP ---
    useEffect(() => {
        if (!isPlaying || !battleResult || !room || currentRoundIndex < 0) return;

        if (currentRoundIndex >= room.boxes.length) {
            if (room.jackpot_enabled) {
                if (jackpotStatus === 'idle') {
                    startJackpotPhase();
                    return;
                }
                if (jackpotStatus === 'spinning') return;
                setRoundStatus('finished');
                return;
            }

            if (battleResult.is_draw && !tiebreakerWinner) {
                setShowTiebreaker(true);
            } else {
                setRoundStatus('finished');
            }
            return;
        }

        const setupRound = async () => {
            if (processingRound) return;
            setProcessingRound(true);
            setAllReelsFinished(false);
            setRoundStatus('idle');

            const boxName = room.boxes[currentRoundIndex];
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
            const roundData = battleResult.rounds[currentRoundIndex];
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
                setRoundResults(new Array(room.max_players).fill(null));
                reelsFinishedCount.current = 0;
                setRoundStatus('spinning');
                setTimeout(() => {
                    if (mounted.current) setRoundResults(nextResults);
                }, 500);
            }
        };
        setupRound();
    }, [currentRoundIndex, isPlaying, battleResult, room, jackpotStatus]); 

    // --- 4. JACKPOT LOGIC ---
    const startJackpotPhase = () => {
        if (!room || !battleResult) return;
        setJackpotStatus('spinning');

        const players = room.players;
        const rawWeights: number[] = new Array(players.length).fill(0);

        if (room.rule === 'terminal') {
            const lastRound = battleResult.rounds[battleResult.rounds.length - 1];
            if (lastRound) {
                lastRound.rolls.forEach(r => {
                    if (r.player_index < rawWeights.length) rawWeights[r.player_index] += r.item_value;
                });
            }
        } else if (room.rule === 'less') {
             const inverseWeights = playerScores.map(s => 1 / Math.max(s, 1));
             inverseWeights.forEach((w, i) => rawWeights[i] = w);
        } else {
            playerScores.forEach((s, i) => rawWeights[i] = s);
        }

        if (rawWeights.every(w => w === 0)) rawWeights.fill(1);

        const teamMap = new Map<number, number>(); 
        // Fix: Use for loop to avoid index type inference issues with forEach
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            const teamId = p.team_index;
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

        let winId = battleResult.winner_team_id;
        if (battleResult.is_draw) {
             const uniqueTeams = Array.from(new Set(room.players.map(p => p.team_index)));
             winId = uniqueTeams[Math.floor(Math.random() * uniqueTeams.length)];
        }
        setJackpotWinner(winId);
    };

    const handleJackpotComplete = () => {
        setJackpotStatus('completed');
        if (user && battleResult) {
            GameService.getUserData(user.id).then(d => d && refreshBalance(d.balance)).catch(() => refreshBalance());
        }
    };

    const handleReelFinished = (playerIdx: number) => {
        reelsFinishedCount.current += 1;
        if (room && reelsFinishedCount.current >= room.max_players) {
            updateScores();
            setAllReelsFinished(true);
            const isLastRound = currentRoundIndex === room.boxes.length - 1;
            const delay = isLastRound ? 2000 : 1000;
            setTimeout(advanceRound, delay);
        }
    };

    const updateScores = () => {
        if (!battleResult || !room) return;
        
        const roundData = battleResult.rounds[currentRoundIndex];
        // Safety check again inside helper
        if (!roundData) return;

        const isWhale = room.rule === 'whale';
        
        const roundTotal = roundData.rolls.reduce((sum: number, r: BattleRoll) => sum + r.item_value, 0);
        setCurrentPot(prev => prev + roundTotal);

        setPlayerScores((prev: number[]) => {
            const next = [...prev];
            roundData.rolls.forEach((roll: BattleRoll) => {
                const pIdx = roll.player_index;
                if (typeof pIdx === 'number' && pIdx < next.length) {
                    if (isWhale) {
                        next[pIdx] = Math.max(next[pIdx], roll.item_value);
                    } else {
                        next[pIdx] += roll.item_value;
                    }
                }
            });
            return next;
        });
    };

    const advanceRound = () => {
        setProcessingRound(false);
        setCurrentRoundIndex(idx => idx + 1);
    };

    // --- 6. TIEBREAKER ---
    useEffect(() => {
        if (showTiebreaker && !tiebreakerSpinning && !tiebreakerResult) {
            const teams = Array.from(new Set(room?.players.map(p => p.team_index)));
            const randomWinnerTeam = teams[Math.floor(Math.random() * teams.length)] as number;
            const winnerConfig = TEAM_COLORS[randomWinnerTeam];
            
            setTiebreakerSpinning(true);
            setTimeout(() => {
                setTiebreakerResult({
                    payout: 0,
                    tier: 'gold',
                    item_name: winnerConfig.name,
                    item_icon: '🏆',
                    is_golden: true
                });
                setTiebreakerWinner(randomWinnerTeam);
            }, 500);
        }
    }, [showTiebreaker]);

    const handleTiebreakerComplete = () => {
        setTimeout(() => {
            setShowTiebreaker(false);
            setRoundStatus('finished');
            if (user && battleResult) {
                GameService.getUserData(user.id).then(d => d && refreshBalance(d.balance)).catch(() => refreshBalance());
            }
        }, 3000);
    };

    if (!room) return <div className="p-20 text-center font-black uppercase text-muted animate-pulse">Initializing Battle Terminal...</div>;

    const winnerTeamId = (tiebreakerWinner !== null) ? tiebreakerWinner : (jackpotWinner !== null) ? jackpotWinner : battleResult?.winner_team_id;
    const isWhale = room?.rule === 'whale';
    const isTerminal = room?.rule === 'terminal';
    const isLess = room?.rule === 'less';
    const isCreator = user && room.creator_id === user.id;
    const isJoined = room && user ? room.players.some(p => p.id === user.id) : false;
    const isFinished = roundStatus === 'finished';

    const displayPot = room.status === 'waiting' ? room.cost_per_player : currentPot;
    const potLabel = room.status === 'waiting' ? 'Buy-In' : 'Current Pot';
    const endScreenPot = battleResult ? battleResult.total_pot : displayPot;

    const currentBoxName = room.boxes[currentRoundIndex] || null;
    const nextBoxName = room.boxes[currentRoundIndex + 1] || null;
    const currentBoxInfo = allBoxInfos.find(b => b.name === currentBoxName);
    const nextBoxInfo = allBoxInfos.find(b => b.name === nextBoxName);
    
    // Calculate Outcome Variables for End Screen
    let userPayout = 0;
    let userTeamIndex = -1;
    let userOutcomeTitle = '';
    let userOutcomeColor = '';

    if (isFinished && user && battleResult) {
        // Need safety check here too if rounds[0] is missing
        const firstRound = battleResult.rounds[0];
        const userRoll = firstRound?.rolls.find((r: any) => r.user_id === user.id);
        
        if (userRoll) {
            userTeamIndex = battleResult.player_teams[userRoll.player_index];
            const isDraw = battleResult.is_draw && !tiebreakerWinner; 
            
             if (isDraw && !jackpotWinner) {
                userPayout = Math.floor((battleResult.total_pot || 0) / room.max_players);
                userOutcomeTitle = "Draw - Refunded";
                userOutcomeColor = "text-white";
            } else if (userTeamIndex === winnerTeamId) {
                 const winnersCount = battleResult.player_teams.filter(t => t === winnerTeamId).length;
                 userPayout = Math.floor((battleResult.total_pot || 0) / (winnersCount || 1));
                 userOutcomeTitle = "Victory";
                 userOutcomeColor = "text-neon1";
            } else {
                 userPayout = 0;
                 userOutcomeTitle = "Defeat";
                 userOutcomeColor = "text-red-500";
            }
        }
    }

    let EndScreen = null;
    if (isFinished && battleResult) {
        let title = "";
        let color = "";
        let totalPot = battleResult.total_pot || 0;

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

    const tiebreakerPool: BoxItem[] = room ? Array.from(new Set(room.players.map(p => p.team_index))).map((tIdx: number) => ({
         name: TEAM_COLORS[tIdx].name, tier: 'gold', value: 0, image: '🏆', weight: 100 
    })) : [];

    return (
        <div className="container mx-auto p-2 sm:p-4 max-w-[95vw] 2xl:max-w-[1800px] flex flex-col h-[90vh] overflow-hidden justify-between animate-fade-in relative">
             
             {/* --- TOP HUD --- */}
             <div className="flex justify-between items-start shrink-0 p-2 z-20">
                <div className="bg-[#0e1020]/90 backdrop-blur border border-[#2a2c45] p-3 rounded-2xl shadow-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-neon1/10 border border-neon1/20 flex items-center justify-center text-xl">
                        {RULE_ICONS[room.rule] || '⚔️'}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                             <div className="text-[10px] bg-white/10 px-1.5 rounded text-white font-bold uppercase">Replay</div>
                             <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">ID: {id}</div>
                        </div>
                        <h1 className="text-sm font-black text-white italic uppercase tracking-wider">
                             {room.rule} • {room.mode}
                             {room.jackpot_enabled && <span className="text-yellow-400 ml-2">✦ JACKPOT</span>}
                        </h1>
                    </div>
                </div>

                <div className="flex gap-2">
                    {isPlaying && (
                         <div className="bg-[#0e1020]/90 backdrop-blur border border-[#2a2c45] p-3 rounded-2xl shadow-xl text-right min-w-[100px]">
                            <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Round</div>
                            <div className="text-xl font-black text-white leading-none">{currentRoundIndex + 1}<span className="text-gray-600 text-xs">/{room.boxes.length}</span></div>
                        </div>
                    )}

                    {room.status === 'waiting' && (
                         <div className="flex gap-2 bg-[#0e1020]/90 backdrop-blur border border-[#2a2c45] p-2 rounded-2xl shadow-xl pointer-events-auto">
                            {!isJoined && <button onClick={handleJoin} disabled={isJoining} className="px-6 py-2 bg-neon1 text-black font-black uppercase text-[10px] rounded-xl hover:bg-white disabled:opacity-50">Join</button>}
                            {isCreator && (
                                <>
                                    <button 
                                        onClick={handleCancelClick} 
                                        disabled={isCancelling} 
                                        className="px-4 py-2 bg-red-500/20 text-red-500 font-bold uppercase text-[9px] rounded-xl border border-red-500/20 hover:bg-red-500 hover:text-white cursor-pointer z-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    {room.players.length < room.max_players && <button onClick={handleAddBot} disabled={isAddingBot} className="px-4 py-2 bg-white/10 text-white font-bold uppercase text-[9px] rounded-xl border border-white/5 hover:bg-white hover:text-black">+AI</button>}
                                    {room.players.length === room.max_players && !isPlaying && <button onClick={startBattleSimulation} className="px-6 py-2 bg-yellow-400 text-black font-black uppercase text-[10px] rounded-xl hover:brightness-110 shadow-[0_0_15px_rgba(250,204,21,0.4)]">Start</button>}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {error && <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 p-2 bg-red-500/90 border border-red-500 rounded text-white text-[10px] font-black uppercase text-center shadow-xl">{error}</div>}

            {showCancelModal && (
                <ConfirmationModal
                    isOpen={showCancelModal}
                    title="Abort Mission"
                    message="Are you sure you want to cancel this battle? Entry fees will be refunded to all players."
                    confirmLabel="Confirm Cancel"
                    isDestructive={true}
                    isLoading={isCancelling}
                    onConfirm={confirmCancelBattle}
                    onCancel={() => setShowCancelModal(false)}
                />
            )}

            {/* --- MIDDLE GRID (Players) --- */}
            {/* Added lg:grid-cols-4 and xl:grid-cols-6 to support wider layouts */}
            <div className={`flex-1 grid grid-cols-2 lg:grid-cols-${Math.min(room.max_players, 4)} xl:grid-cols-${Math.min(room.max_players, 6)} gap-2 md:gap-4 items-center p-1 relative z-30`}>
                {displayIndices.map((idx: number) => {
                    const player = room.players[idx];
                    const teamId = player?.team_index ?? (idx % 2); // Fallback for waiting slots
                    const tConfig = TEAM_COLORS[teamId as number] || TEAM_COLORS[0];
                    const isWinner = roundStatus === 'finished' && teamId === winnerTeamId;
                    const roundResult = roundResults[idx];

                    let jackpotPercentDisplay = null;
                    if (room.jackpot_enabled && isPlaying) {
                        let odds = 0;
                        const totalPlayers = room.max_players;

                        if (isTerminal) {
                             const isLastRound = currentRoundIndex === room.boxes.length - 1;
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
                        <div key={idx} className={`flex flex-col h-full max-h-[500px] transition-all duration-700 ${isWinner ? 'scale-105 z-20' : 'scale-100'} relative`}>
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
                                {player ? (player.is_bot ? 'AI' : (player.id === user?.id ? 'YOU' : `P${idx+1}`)) : '...'}
                            </div>
                            
                            <div className={`flex-1 bg-[#0e1020] border-x border-b rounded-b-xl relative overflow-hidden shadow-2xl flex items-center justify-center ${tConfig.border} ${isWinner ? 'border-yellow-400 ring-2 ring-yellow-400/20' : ''}`}>
                                {player ? (
                                    <SlotReel 
                                        key={currentRoundIndex} // Key to force reset on round change
                                        spinning={roundStatus === 'spinning' && !roundResult} 
                                        result={roundResult} 
                                        pool={activePool} 
                                        isVertical={true} 
                                        onStop={() => handleReelFinished(idx)}
                                        compact={room.max_players > 4}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-4 opacity-10"><div className="text-3xl">📡</div></div>
                                )}
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
