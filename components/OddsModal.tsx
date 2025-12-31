
import React, { useMemo, useState } from 'react';
import { BoxInfo, BoxItem } from '../types';
import { TIER_COLORS, getItemIcon, getItemImageUrl } from '../constants';

interface OddsModalProps {
    box: BoxInfo;
    items: BoxItem[];
    onClose: () => void;
}

export const OddsModal: React.FC<OddsModalProps> = ({ box, items, onClose }) => {
    const [hoveredItem, setHoveredItem] = useState<BoxItem | null>(null);

    // Calculate RTP (Weighted)
    const stats = useMemo(() => {
        if (!items.length || !box.price) return { rtp: 0, avgReturn: 0, totalWeight: 0 };
        
        // Sum of all weights
        const totalWeight = items.reduce((sum, item) => sum + (item.weight || 100), 0);
        
        // Weighted Value Sum
        const weightedValueSum = items.reduce((sum, item) => sum + (item.value * (item.weight || 100)), 0);
        
        const avgReturn = weightedValueSum / totalWeight;
        const rtp = (avgReturn / box.price) * 100;
        
        return { rtp, avgReturn, totalWeight };
    }, [items, box.price]);

    // Group by tier
    const tierStats = useMemo(() => {
        if (items.length === 0) return [];

        const groups: Record<string, { items: BoxItem[], weightSum: number }> = {};
        
        items.forEach(item => {
            const t = item.tier.toLowerCase();
            if (!groups[t]) groups[t] = { items: [], weightSum: 0 };
            groups[t].items.push(item);
            groups[t].weightSum += (item.weight || 100);
        });

        const order = ['gray', 'green', 'blue', 'red', 'gold'];
        
        return order.map(tier => {
            const group = groups[tier];
            if (!group || group.items.length === 0) return null;
            
            // Probability = TierWeight / TotalWeight
            const chance = (group.weightSum / stats.totalWeight) * 100;
            
            return {
                tier,
                items: group.items.sort((a,b) => a.value - b.value),
                chance,
                count: group.items.length
            };
        }).filter(Boolean) as { tier: string, items: BoxItem[], chance: number, count: number }[];
    }, [items, stats.totalWeight]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="relative w-full max-w-lg bg-[#0e1020] border border-[#2a2c45] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[80vh] animate-slide-in" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-4 border-b border-[#2a2c45] flex justify-between items-center bg-[#1a1d2e]">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-wider">{box.name}</h2>
                        <p className="text-xs text-muted">Box Contents & Odds</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl font-bold px-2">✕</button>
                </div>

                {/* Stats Bar */}
                <div className="flex divide-x divide-white/10 border-b border-[#2a2c45] bg-black/20">
                    <div className="flex-1 p-3 text-center">
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Box Price</div>
                        <div className="text-sm font-bold text-white">{box.price.toLocaleString()} GP</div>
                    </div>
                    <div className="flex-1 p-3 text-center">
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Avg Return</div>
                        <div className="text-sm font-bold text-neon3">{stats.avgReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })} GP</div>
                    </div>
                    <div className="flex-1 p-3 text-center">
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Theoretical RTP</div>
                        <div className={`text-sm font-black ${stats.rtp > 100 ? 'text-green-400' : stats.rtp >= 94 ? 'text-neon1' : 'text-red-400'}`}>
                            {stats.rtp.toFixed(2)}%
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-4 space-y-4 scrollbar-hide">
                    {tierStats.map((stat) => (
                        <div key={stat.tier} className="bg-black/20 rounded-lg border border-white/5 overflow-hidden">
                            {/* Tier Header */}
                            <div className="flex items-center justify-between p-3 bg-white/5" style={{ borderLeft: `4px solid ${TIER_COLORS[stat.tier]}` }}>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded text-black" style={{ backgroundColor: TIER_COLORS[stat.tier] }}>
                                        {stat.tier}
                                    </span>
                                    <span className="text-xs font-bold text-gray-400">({stat.count} items)</span>
                                </div>
                                <span className="text-sm font-bold text-white">{stat.chance.toFixed(2)}%</span>
                            </div>
                            
                            {/* Items Grid */}
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 p-3 bg-black/40">
                                {stat.items.map((item, idx) => (
                                    <div 
                                        key={`${item.name}-${idx}`} 
                                        className="flex flex-col items-center cursor-help p-1 rounded-lg hover:bg-white/5 transition-all"
                                        onMouseEnter={() => setHoveredItem(item)}
                                        onMouseLeave={() => setHoveredItem(null)}
                                        onClick={() => setHoveredItem(item)} // Mobile support
                                    >
                                        <div className="w-8 h-8 md:w-10 md:h-10 mb-1 drop-shadow-md flex items-center justify-center">
                                            {item.image ? (
                                                <img src={getItemImageUrl(item.image)} alt={item.name} className="w-full h-full object-contain brightness-125" />
                                            ) : (
                                                <span className="text-2xl">{getItemIcon(item.name)}</span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-gray-400 font-mono">{item.value.toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && <div className="text-center text-gray-500 py-8">No items found in this box.</div>}
                </div>
                
                {/* Footer - Dynamic Info Panel */}
                <div className="p-4 border-t border-[#2a2c45] bg-[#1a1d2e] min-h-[80px] flex items-center justify-center">
                    {hoveredItem ? (
                        <div className="flex flex-col items-center animate-fade-in w-full">
                            <div className="text-sm font-black text-white uppercase tracking-wider text-center" style={{ color: TIER_COLORS[hoveredItem.tier.toLowerCase()] || 'white' }}>
                                {hoveredItem.name}
                            </div>
                            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs mt-2 w-full">
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] text-gray-500 uppercase font-bold">Value</span>
                                    <span className="text-neon3 font-mono font-bold">{hoveredItem.value.toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] text-gray-500 uppercase font-bold">Probability</span>
                                    <span className="text-white font-mono">
                                        {(( (hoveredItem.weight || 100) / stats.totalWeight ) * 100).toFixed(4)}%
                                    </span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] text-gray-500 uppercase font-bold">Tier</span>
                                    <span className="uppercase font-bold" style={{ color: TIER_COLORS[hoveredItem.tier.toLowerCase()] }}>{hoveredItem.tier}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Information System</p>
                            <p className="text-xs text-gray-400">Hover over an item to view detailed analytics.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
