
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { GameService } from '../services/gameService';
import { BoxInfo, BoxItem } from '../types';
import { getBoxImageUrl, getItemImageUrl, getItemIcon, TIER_COLORS } from '../constants';

export const AchievementGallery: React.FC = () => {
    const { user, login, refreshBalance } = useAuth();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [boxes, setBoxes] = useState<BoxInfo[]>([]);
    const [allItems, setAllItems] = useState<Record<number, BoxItem[]>>({});
    const [unlocks, setUnlocks] = useState<Set<string>>(new Set());
    const [claimedRewards, setClaimedRewards] = useState<Set<number>>(new Set());
    const [claimingBoxId, setClaimingBoxId] = useState<number | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterState, setFilterState] = useState<'all' | 'unlocked' | 'locked'>('all');

    // Detail Modal
    const [selectedItem, setSelectedItem] = useState<{ item: BoxItem, boxName: string, totalBoxWeight: number } | null>(null);

    useEffect(() => {
        if (!user) {
            login();
            return;
        }

        const loadGallery = async () => {
            setLoading(true);
            try {
                // Fetch basic data
                const [boxList, itemsMap, unlockList, claimedList] = await Promise.all([
                    GameService.getBoxes(),
                    GameService.getAllBoxItems(),
                    GameService.getUnlockedItems(user.id),
                    GameService.getClaimedCollectionRewards(user.id)
                ]);

                setBoxes(boxList);
                setAllItems(itemsMap);

                // Create a Set of "itemName" for quick lookup
                const unlockedSet = new Set<string>();
                unlockList.forEach(u => unlockedSet.add(u.item_name));
                setUnlocks(unlockedSet);
                
                setClaimedRewards(new Set(claimedList));

            } catch (e) {
                console.error("Gallery load error", e);
            } finally {
                setLoading(false);
            }
        };

        loadGallery();
    }, [user]);

    const handleClaimReward = async (boxId: number, rewardAmount: number) => {
        if (!user) return;
        setClaimingBoxId(boxId);
        try {
            await GameService.claimCollectionReward(user.id, boxId, rewardAmount);
            await refreshBalance();
            setClaimedRewards(prev => new Set(prev).add(boxId));
            alert(`Reward Claimed: ${rewardAmount.toLocaleString()} GP!`);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setClaimingBoxId(null);
        }
    };

    const generateFlavorText = (item: BoxItem, boxName: string) => {
        const tier = item.tier.toLowerCase();
        if (tier === 'gold' || tier === 'legendary') return `A mythical relic from the ${boxName} collection. Its power is unmatched.`;
        if (tier === 'red' || tier === 'epic') return `An extraordinarily rare find from ${boxName}. Coveted by many.`;
        if (tier === 'blue' || tier === 'rare') return `A distinct artifact of value found within ${boxName}.`;
        return `A standard issue item from the ${boxName} series.`;
    };

    // Calculate total stats
    const totalItemsCount = useMemo(() => {
        return Object.values(allItems).reduce((acc: number, list: any) => acc + (list?.length || 0), 0);
    }, [allItems]);

    const unlockedCount = unlocks.size;
    const progressPercent = totalItemsCount > 0 ? (unlockedCount / totalItemsCount) * 100 : 0;

    // Filter Logic
    const filteredBoxes = useMemo(() => {
        return boxes.map(box => {
            const items = allItems[box.box_id] || [];
            const matches = items.filter(item => {
                const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
                const isUnlocked = unlocks.has(item.name);
                const matchesStatus = filterState === 'all' 
                    ? true 
                    : filterState === 'unlocked' ? isUnlocked : !isUnlocked;
                return matchesSearch && matchesStatus;
            });
            return { ...box, items: matches, totalWeight: items.reduce((sum, i) => sum + (i.weight || 100), 0) };
        }).filter(b => b.items.length > 0);
    }, [boxes, allItems, searchTerm, filterState, unlocks]);

    return (
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-white transition-colors">← Back</button>
                        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Achievement Gallery</h1>
                    </div>
                    <p className="text-sm text-gray-400 max-w-lg">
                        Collection of artifacts recovered from the Archive. Items are unlocked by unboxing them in Solo Play or by your team in Battle.
                    </p>
                </div>

                <div className="text-right bg-[#0e1020] border border-[#2a2c45] p-4 rounded-xl shadow-lg min-w-[200px]">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Collection Progress</div>
                    <div className="text-2xl font-black text-neon1">{unlockedCount} <span className="text-sm text-gray-600">/ {totalItemsCount}</span></div>
                    <div className="h-2 bg-black rounded-full mt-2 border border-white/10 overflow-hidden">
                        <div className="h-full bg-neon1 transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-[#0e1020] border border-[#2a2c45] rounded-xl p-4 mb-8 flex flex-col sm:flex-row gap-4">
                <input 
                    type="text" 
                    placeholder="Search artifacts..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-[#1a1d2e] border border-[#2a2c45] rounded-lg px-4 py-2 text-sm text-white focus:border-neon1 outline-none"
                />
                <div className="flex bg-[#1a1d2e] p-1 rounded-lg border border-[#2a2c45]">
                    {(['all', 'unlocked', 'locked'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilterState(f)}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${filterState === f ? 'bg-neon1 text-black' : 'text-gray-500 hover:text-white'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 border-neon1 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <div className="text-xs font-bold uppercase tracking-widest text-muted animate-pulse">Scanning Archive...</div>
                </div>
            ) : (
                <div className="space-y-12 animate-fade-in">
                    {filteredBoxes.map(box => {
                        // Original full list for completion check logic (completion is based on box TOTAL, not filtered view)
                        const allBoxItems = allItems[box.box_id] || [];
                        const boxUnlockedCount = allBoxItems.filter(i => unlocks.has(i.name)).length;
                        
                        const isComplete = boxUnlockedCount === allBoxItems.length;
                        const isClaimed = claimedRewards.has(box.box_id);
                        const rewardValue = box.price * 100;

                        return (
                            <div key={box.box_id} className={`bg-[#0e1020] border rounded-2xl p-6 shadow-xl transition-all ${isComplete && !isClaimed ? 'border-neon1/50 shadow-[0_0_30px_rgba(109,249,255,0.1)]' : 'border-[#2a2c45]'}`}>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-[#2a2c45] pb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-black/40 rounded-xl border border-white/5 p-2">
                                            <img src={getBoxImageUrl(box.image)} alt={box.name} className="w-full h-full object-contain" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                                {box.name}
                                                {isComplete && <span className="text-neon1 text-lg">✓</span>}
                                            </h2>
                                            <div className="text-xs text-gray-500 font-mono mt-1">
                                                {boxUnlockedCount} / {allBoxItems.length} Recovered
                                            </div>
                                        </div>
                                    </div>

                                    {/* Completion Reward Action (Visible only if viewing ALL items or at least relevant context) */}
                                    <div className="flex items-center">
                                        {isClaimed ? (
                                            <div className="px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-400 font-bold uppercase text-xs rounded-lg flex items-center gap-2">
                                                <span>✓</span> Reward Claimed
                                            </div>
                                        ) : isComplete ? (
                                            <button 
                                                onClick={() => handleClaimReward(box.box_id, rewardValue)}
                                                disabled={claimingBoxId === box.box_id}
                                                className="px-6 py-3 bg-neon1 text-black font-black uppercase text-xs rounded-xl hover:bg-white hover:scale-105 transition-all shadow-[0_0_15px_rgba(109,249,255,0.4)] animate-pulse"
                                            >
                                                {claimingBoxId === box.box_id ? 'Processing...' : `Claim ${rewardValue.toLocaleString()} GP`}
                                            </button>
                                        ) : (
                                            <div className="text-right opacity-50">
                                                <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Completion Reward</div>
                                                <div className="text-sm font-bold text-gray-300">{rewardValue.toLocaleString()} GP</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                    {box.items.sort((a,b) => a.value - b.value).map(item => {
                                        const isUnlocked = unlocks.has(item.name);
                                        const tierColor = TIER_COLORS[item.tier.toLowerCase()] || '#888';
                                        
                                        return (
                                            <div 
                                                key={item.item_id || item.name} 
                                                onClick={() => setSelectedItem({ item, boxName: box.name, totalBoxWeight: box.totalWeight })}
                                                className={`
                                                    relative group rounded-xl border p-3 flex flex-col items-center text-center transition-all duration-500 overflow-hidden cursor-pointer
                                                    ${isUnlocked 
                                                        ? 'bg-[#1a1d2e] border-white/10 hover:border-white/30 hover:-translate-y-1 hover:shadow-[0_5px_15px_rgba(0,0,0,0.5)]' 
                                                        : 'bg-black/40 border-dashed border-white/5 opacity-50 grayscale hover:opacity-70'}
                                                `}
                                            >
                                                {/* Status Icon */}
                                                {!isUnlocked && (
                                                    <div className="absolute top-2 right-2 text-gray-600 text-xs">🔒</div>
                                                )}

                                                <div className="w-12 h-12 mb-3 relative z-10 flex items-center justify-center">
                                                    {item.image ? (
                                                        <img src={getItemImageUrl(item.image)} alt={item.name} className="w-full h-full object-contain drop-shadow-md brightness-125" />
                                                    ) : (
                                                        <span className="text-3xl">{getItemIcon(item.name)}</span>
                                                    )}
                                                </div>

                                                <div className="w-full z-10">
                                                    <div className={`text-[10px] font-bold uppercase truncate mb-1 ${isUnlocked ? 'text-gray-200' : 'text-gray-600'}`}>
                                                        {item.name}
                                                    </div>
                                                    <div className="flex justify-center items-center gap-2">
                                                        <span 
                                                            className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase"
                                                            style={{ backgroundColor: isUnlocked ? `${tierColor}20` : '#333', color: isUnlocked ? tierColor : '#666' }}
                                                        >
                                                            {item.tier}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Glow Effect for Unlocked */}
                                                {isUnlocked && (
                                                    <div 
                                                        className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none"
                                                        style={{ background: `radial-gradient(circle at center, ${tierColor}, transparent)` }}
                                                    ></div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    
                    {filteredBoxes.length === 0 && (
                        <div className="p-20 text-center text-gray-500 italic">No artifacts match your criteria.</div>
                    )}
                </div>
            )}

            {/* ITEM DETAIL MODAL */}
            {selectedItem && (
                <div 
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
                    onClick={() => setSelectedItem(null)}
                >
                    <div 
                        className="bg-[#0e1020] border-2 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-slide-in relative"
                        style={{ borderColor: TIER_COLORS[selectedItem.item.tier.toLowerCase()] || '#333' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setSelectedItem(null)} 
                            className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-white text-white hover:text-black transition-colors"
                        >
                            ✕
                        </button>

                        <div className="p-8 flex flex-col items-center text-center relative overflow-hidden">
                            {/* Radial Glow BG */}
                            <div 
                                className="absolute inset-0 opacity-20 pointer-events-none"
                                style={{ background: `radial-gradient(circle at center, ${TIER_COLORS[selectedItem.item.tier.toLowerCase()]}, transparent 70%)` }}
                            ></div>

                            <div className="w-48 h-48 mb-6 relative z-10 filter drop-shadow-2xl">
                                {selectedItem.item.image ? (
                                    <img src={getItemImageUrl(selectedItem.item.image)} alt={selectedItem.item.name} className="w-full h-full object-contain brightness-125 animate-float" />
                                ) : (
                                    <div className="text-8xl">{getItemIcon(selectedItem.item.name)}</div>
                                )}
                            </div>

                            <div className="relative z-10 space-y-4 w-full">
                                <span 
                                    className="px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-white/10"
                                    style={{ 
                                        backgroundColor: `${TIER_COLORS[selectedItem.item.tier.toLowerCase()]}20`, 
                                        color: TIER_COLORS[selectedItem.item.tier.toLowerCase()] 
                                    }}
                                >
                                    {selectedItem.item.tier}
                                </span>

                                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{selectedItem.item.name}</h2>
                                
                                <p className="text-gray-400 text-sm italic font-serif leading-relaxed px-4">
                                    "{generateFlavorText(selectedItem.item, selectedItem.boxName)}"
                                </p>

                                <div className="grid grid-cols-2 gap-4 mt-6 w-full pt-6 border-t border-white/10">
                                    <div className="bg-black/30 p-3 rounded-xl">
                                        <div className="text-[9px] text-gray-500 font-bold uppercase mb-1">Found In</div>
                                        <div className="text-white font-bold text-sm">{selectedItem.boxName}</div>
                                    </div>
                                    <div className="bg-black/30 p-3 rounded-xl">
                                        <div className="text-[9px] text-gray-500 font-bold uppercase mb-1">Drop Chance</div>
                                        <div className="text-neon1 font-bold text-sm font-mono">
                                            {(( (selectedItem.item.weight || 100) / selectedItem.totalBoxWeight ) * 100).toFixed(4)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
