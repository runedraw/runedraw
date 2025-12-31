
import React from 'react';
import { RULE_ICONS } from '../constants';

interface BattleTutorialModalProps {
    onClose: () => void;
}

export const BattleTutorialModal: React.FC<BattleTutorialModalProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div 
                className="relative w-full max-w-2xl bg-[#0e1020] border border-neon1 rounded-xl shadow-[0_0_50px_rgba(109,249,255,0.15)] flex flex-col max-h-[85vh] animate-slide-in" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-[#2a2c45] flex justify-between items-center bg-[#1a1d2e] rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-neon1 text-black flex items-center justify-center text-xl font-black">
                            ?
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-wider">Battle Academy</h2>
                            <p className="text-xs text-neon1 font-bold uppercase tracking-widest">Field Manual v1.0</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-6 space-y-8 scrollbar-hide">
                    
                    {/* Section 1: Basics */}
                    <section>
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-3 border-l-2 border-neon1 pl-3">
                            The Basics
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed bg-black/20 p-4 rounded-lg border border-white/5">
                            Battles are PVP box openings. You select a set of boxes (the "Cart"), and other players pay the same cost to join. 
                            Everyone opens the same boxes. The player (or team) with the best outcome wins the 
                            <span className="text-neon1 font-bold"> Total Pot</span>.
                        </p>
                    </section>

                    {/* Section 2: Modes */}
                    <section>
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-3 border-l-2 border-neon1 pl-3">
                            Team Modes
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-[#1a1d2e] p-3 rounded border border-white/5">
                                <div className="text-xs font-bold text-neon1 mb-1 uppercase">Free For All (1v1, 1v1v1...)</div>
                                <p className="text-xs text-gray-400">Every player fends for themselves. The winner takes everything.</p>
                            </div>
                            <div className="bg-[#1a1d2e] p-3 rounded border border-white/5">
                                <div className="text-xs font-bold text-purple-400 mb-1 uppercase">Team Battle (2v2, 3v3)</div>
                                <p className="text-xs text-gray-400">Winnings are calculated by Team Sum. If your team wins, the pot is split evenly between teammates.</p>
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Rules */}
                    <section>
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-3 border-l-2 border-neon1 pl-3">
                            Win Conditions (Rules)
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            
                            <div className="flex items-start gap-4 bg-black/40 p-3 rounded border border-white/5 hover:border-neon1/30 transition-colors">
                                <div className="text-2xl bg-white/5 w-10 h-10 flex items-center justify-center rounded">{RULE_ICONS['classic']}</div>
                                <div>
                                    <div className="text-sm font-bold text-white uppercase">Classic</div>
                                    <p className="text-xs text-gray-400 mt-1">Highest <span className="text-white font-bold">Total Value</span> wins. All items from all rounds are summed up.</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 bg-black/40 p-3 rounded border border-white/5 hover:border-neon1/30 transition-colors">
                                <div className="text-2xl bg-white/5 w-10 h-10 flex items-center justify-center rounded">{RULE_ICONS['whale']}</div>
                                <div>
                                    <div className="text-sm font-bold text-white uppercase">Whale</div>
                                    <p className="text-xs text-gray-400 mt-1">Highest <span className="text-white font-bold">Single Item</span> wins. The total sum doesn't matter, only the most expensive item pulled in the entire match.</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 bg-black/40 p-3 rounded border border-white/5 hover:border-neon1/30 transition-colors">
                                <div className="text-2xl bg-white/5 w-10 h-10 flex items-center justify-center rounded">{RULE_ICONS['less']}</div>
                                <div>
                                    <div className="text-sm font-bold text-white uppercase">Less</div>
                                    <p className="text-xs text-gray-400 mt-1">Lowest <span className="text-white font-bold">Total Value</span> wins. You want to get the worst items possible.</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 bg-black/40 p-3 rounded border border-white/5 hover:border-neon1/30 transition-colors">
                                <div className="text-2xl bg-white/5 w-10 h-10 flex items-center justify-center rounded">{RULE_ICONS['terminal']}</div>
                                <div>
                                    <div className="text-sm font-bold text-white uppercase">Terminal</div>
                                    <p className="text-xs text-gray-400 mt-1">Only the <span className="text-white font-bold">Last Round</span> counts. Previous rounds build suspense but do not affect the win condition.</p>
                                </div>
                            </div>

                        </div>
                    </section>

                    {/* Section 4: Jackpot */}
                    <section>
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-3 border-l-2 border-neon1 pl-3">
                            The Jackpot
                        </h3>
                        <div className="bg-gradient-to-r from-yellow-900/20 to-transparent p-4 rounded border border-yellow-600/30">
                            <p className="text-sm text-gray-300">
                                If <span className="text-yellow-400 font-bold">Jackpot</span> is enabled, the winner is not guaranteed. 
                                Instead, your score gives you a <span className="text-white font-bold">% Chance</span> to win. 
                                A wheel is spun at the end to determine the victor based on those odds.
                            </p>
                        </div>
                    </section>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[#2a2c45] bg-[#1a1d2e] rounded-b-xl text-center">
                    <button 
                        onClick={onClose}
                        className="w-full py-3 bg-neon1 text-black font-black uppercase rounded shadow-[0_0_15px_rgba(109,249,255,0.4)] hover:bg-white transition-all"
                    >
                        Understood
                    </button>
                </div>
            </div>
        </div>
    );
};
