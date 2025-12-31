
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameService } from '../services/gameService';
import { BattleRoomData } from '../types';
import { useAuth } from '../App';
import { RULE_ICONS } from '../constants';

export const Battle: React.FC = () => {
    const navigate = useNavigate();
    const { user, login } = useAuth();
    const [activeBattles, setActiveBattles] = useState<BattleRoomData[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'waiting' | 'running'>('waiting');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [active, past] = await Promise.all([
                GameService.getActiveBattles(),
                GameService.getBattleHistory() // Now returns aggregated V2 rows
            ]);
            setActiveBattles(active);
            setHistory(past);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Removed setInterval to prevent flickering. User must manually refresh.
    }, []);

    const handleCreateClick = () => {
        if (!user) { login(); return; }
        navigate('/battle/create');
    };

    const handleJoinBattle = (battleId: number) => {
        if (!user) { login(); return; }
        navigate(`/battle/room/${battleId}`);
    };

    const handleSpectateBattle = (battleId: number) => {
        navigate(`/battle/room/${battleId}`);
    };

    const handleWatchReplay = (battleId: number) => {
        navigate(`/battle/replay/${battleId}`);
    };

    const waitingBattles = activeBattles.filter(b => b.status === 'waiting');
    const runningBattles = activeBattles.filter(b => b.status === 'running');
    
    // Displayed list depends on tab
    const displayedBattles = activeTab === 'waiting' ? waitingBattles : runningBattles;

    return (
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl min-h-[80vh]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">The Colosseum</h1>
                    <p className="text-muted text-sm font-bold uppercase tracking-widest mt-1">Multiplayer Combat Terminal</p>
                </div>
                <button 
                    onClick={handleCreateClick}
                    className="px-10 py-4 bg-neon1 text-black font-black uppercase text-sm rounded-xl shadow-[0_0_25px_rgba(109,249,255,0.4)] hover:scale-105 active:scale-95 transition-all"
                >
                    Create Match
                </button>
            </div>

            {/* LIVE BATTLES SECTION */}
            <div className="mb-12">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
                    <div className="border-l-4 border-neon1 pl-4">
                        <h2 className="text-xs font-black text-white uppercase tracking-[0.2em]">Live Encounters</h2>
                        <span className="text-[10px] text-gray-500 font-mono">BROADCASTING ACTIVE FREQUENCIES</span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Tab Switcher */}
                        <div className="flex bg-[#0e1020] border border-[#2a2c45] rounded-lg p-1">
                            <button 
                                onClick={() => setActiveTab('waiting')}
                                className={`px-4 py-2 text-[10px] font-black uppercase rounded transition-all flex items-center gap-2 ${activeTab === 'waiting' ? 'bg-neon1 text-black' : 'text-gray-500 hover:text-white'}`}
                            >
                                <span>Open Lobbies</span>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] ${activeTab === 'waiting' ? 'bg-black text-neon1' : 'bg-[#2a2c45] text-gray-400'}`}>
                                    {waitingBattles.length}
                                </span>
                            </button>
                            <button 
                                onClick={() => setActiveTab('running')}
                                className={`px-4 py-2 text-[10px] font-black uppercase rounded transition-all flex items-center gap-2 ${activeTab === 'running' ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'text-gray-500 hover:text-white'}`}
                            >
                                <span>Active Conflicts</span>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] ${activeTab === 'running' ? 'bg-black text-red-500' : 'bg-[#2a2c45] text-gray-400'}`}>
                                    {runningBattles.length}
                                </span>
                            </button>
                        </div>
                        
                        {/* Refresh Button */}
                        <button 
                            onClick={fetchData} 
                            disabled={loading}
                            className="h-full px-4 bg-[#0e1020] border border-[#2a2c45] rounded-lg text-white hover:text-neon1 hover:border-neon1 transition-all flex items-center justify-center disabled:opacity-50"
                            title="Refresh List"
                        >
                            <span className={`text-xl ${loading ? 'animate-spin' : ''}`}>↻</span>
                        </button>
                    </div>
                </div>

                {loading && activeBattles.length === 0 ? (
                    <div className="p-16 text-center text-gray-600 animate-pulse uppercase text-[10px] font-bold tracking-[0.4em]">Decrypting transmissions...</div>
                ) : displayedBattles.length === 0 ? (
                    <div className="p-20 text-center bg-black/20 rounded-3xl border-2 border-dashed border-white/5 flex flex-col items-center">
                         <span className="text-4xl mb-4 opacity-20">{activeTab === 'waiting' ? '📡' : '⚔️'}</span>
                         <span className="text-xs font-bold text-gray-600 uppercase tracking-[0.3em]">
                            {activeTab === 'waiting' ? 'No open lobbies available.' : 'No battles currently running.'}
                         </span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayedBattles.map(battle => {
                            const isRunning = battle.status === 'running';
                            return (
                                <div key={battle.id} className={`bg-[#0e1020] border rounded-3xl overflow-hidden transition-all group shadow-2xl flex flex-col ${isRunning ? 'border-red-500/30 hover:border-red-500' : 'border-[#2a2c45] hover:border-neon1/60'}`}>
                                    <div className="p-6 flex justify-between items-start relative overflow-hidden">
                                        {isRunning && <div className="absolute top-0 right-0 p-3"><span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span></div>}
                                        
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className={`w-12 h-12 rounded-2xl bg-black/40 border flex items-center justify-center text-2xl ${isRunning ? 'border-red-500/20 text-red-500' : 'border-white/5'}`}>
                                                {RULE_ICONS[battle.rule] || '⚔️'}
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black text-muted uppercase tracking-wider mb-1">{battle.boxes?.length || 0} ROUNDS</div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white uppercase font-bold">{battle.mode}</span>
                                                    <span className={`text-[10px] bg-opacity-10 border bg-transparent px-2 py-0.5 rounded uppercase font-bold ${isRunning ? 'text-red-500 border-red-500/20' : 'text-neon1 border-neon1/20'}`}>{battle.rule}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {!isRunning && (
                                            <div className="text-right">
                                                <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Filled</div>
                                                <div className="text-2xl font-black text-white">{battle.players.length}/{battle.max_players}</div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="px-6 pb-6 mt-auto">
                                         <div className="flex justify-between items-center mb-6">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold">Entry Fee</span>
                                            <span className="text-lg font-black text-neon1 italic">{battle.cost_per_player.toLocaleString()} <span className="text-[10px] text-muted">GP</span></span>
                                         </div>
                                         
                                         {isRunning ? (
                                             <button 
                                                onClick={() => handleSpectateBattle(battle.id)}
                                                className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-500 font-black uppercase text-xs tracking-[0.2em] rounded-2xl group-hover:bg-red-500 group-hover:text-black transition-all shadow-lg animate-pulse"
                                             >
                                                 Spectate
                                             </button>
                                         ) : (
                                             <button 
                                                onClick={() => handleJoinBattle(battle.id)}
                                                className="w-full py-4 bg-white/5 border border-white/10 text-white font-black uppercase text-xs tracking-[0.2em] rounded-2xl group-hover:bg-neon1 group-hover:text-black group-hover:border-neon1 transition-all shadow-lg"
                                             >
                                                 Join Match
                                             </button>
                                         )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ARCHIVE SECTION */}
            <div>
                 <div className="flex justify-between items-end mb-6 border-l-4 border-red-500/50 pl-4">
                    <h2 className="text-xs font-black text-white uppercase tracking-[0.2em]">Recorded Archive</h2>
                    <span className="text-[10px] text-gray-500 font-mono">PAST CONFLICTS (GLOBAL)</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {history.slice(0, 10).map(battle => {
                        return (
                             <div key={battle.user_battle_id || battle.battle_id} className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-[#1a1d2e] hover:bg-white/[0.04] transition-all group">
                                <div className="flex items-center gap-4">
                                     <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-xl grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                                        {RULE_ICONS[battle.rule?.toLowerCase()] || '⚔️'}
                                     </div>
                                     <div>
                                         <div className="text-[11px] font-black text-white uppercase tracking-wider mb-1">
                                             {battle.mode} • {battle.rule}
                                         </div>
                                         <div className="text-[9px] text-gray-600 font-mono uppercase">{new Date(battle.completed_at || battle.created_at).toLocaleString()}</div>
                                     </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden sm:block">
                                        <div className="text-[9px] text-gray-600 uppercase font-black mb-0.5">Pot</div>
                                        <div className="text-sm font-black text-white">{(battle.total_pot || 0).toLocaleString()} <span className="text-[10px] text-muted">GP</span></div>
                                    </div>
                                    <button 
                                        onClick={() => handleWatchReplay(battle.battle_id)}
                                        className="px-6 py-2.5 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase rounded-lg shadow-lg hover:bg-white hover:text-black transition-all"
                                    >
                                        Replay
                                    </button>
                                </div>
                             </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
