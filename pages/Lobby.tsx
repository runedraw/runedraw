
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameService } from '../services/gameService';
import { BoxInfo, BoxItem } from '../types';
import { OddsModal } from '../components/OddsModal';
import { getBoxImageUrl } from '../constants';

export const Lobby: React.FC = () => {
    const [boxes, setBoxes] = useState<BoxInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const navigate = useNavigate();

    // Odds Modal State
    const [viewingBox, setViewingBox] = useState<BoxInfo | null>(null);
    const [viewingBoxItems, setViewingBoxItems] = useState<BoxItem[]>([]);

    useEffect(() => {
        GameService.getBoxes()
            .then(data => {
                setBoxes(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const filteredBoxes = boxes.filter(b => b.name.toLowerCase().includes(filter.toLowerCase()));

    const handleOpenOdds = async (e: React.MouseEvent, box: BoxInfo) => {
        e.stopPropagation(); // Stop card click
        setViewingBox(box);
        setViewingBoxItems([]); // Clear old
        try {
            const items = await GameService.getBoxItems(box.box_id);
            setViewingBoxItems(items);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="container mx-auto p-4 pb-20 max-w-7xl min-h-[80vh]">
            {/* Toolbar */}
            <div className="bg-[#0e1020] border border-[#2a2c45] rounded-xl p-4 mb-8 flex flex-wrap gap-4 items-end shadow-lg shadow-black/40">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-xs text-muted font-bold uppercase tracking-wider mb-2 block">Search</label>
                    <input 
                        type="text" 
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Find a box..."
                        className="w-full bg-[#080a16] border border-[#2a2c45] rounded-lg p-3 text-white focus:border-neon1 outline-none"
                    />
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-20 text-muted animate-pulse">
                    <div className="text-4xl mb-4">✦</div>
                    <div className="text-sm font-bold uppercase tracking-widest">Loading Artifacts...</div>
                </div>
            )}

            {/* Empty State */}
            {!loading && boxes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <div className="text-4xl mb-4 grayscale">📦</div>
                    <div className="text-sm font-bold uppercase tracking-widest">No boxes found</div>
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredBoxes.map(box => (
                    <div 
                        key={box.box_id} 
                        onClick={() => navigate(`/game/${box.box_id}`)}
                        className="group relative bg-[#0e1020] border border-[#2a2c45] rounded-xl p-4 cursor-pointer hover:-translate-y-2 hover:border-neon1 hover:shadow-[0_8px_30px_rgba(109,249,255,0.15)] transition-all duration-300 flex flex-col"
                    >
                        <div className="absolute top-3 right-3 z-10">
                            <button 
                                onClick={(e) => handleOpenOdds(e, box)}
                                className="w-5 h-5 rounded-full bg-black/60 border border-white/20 text-gray-300 flex items-center justify-center text-[10px] font-serif hover:bg-neon1 hover:text-black hover:border-neon1 transition-all"
                                title="View Odds"
                            >
                                i
                            </button>
                        </div>

                        <div className="flex justify-between items-center mb-4 pr-6">
                            <span className="bg-gray-700 text-white text-[10px] font-bold px-2 py-1 rounded-full">{box.name}</span>
                        </div>
                        
                        <div className="flex-1 flex items-center justify-center mb-6">
                            <img 
                                src={getBoxImageUrl(box.image)}
                                alt={box.name}
                                className="w-32 h-32 object-contain drop-shadow-lg group-hover:animate-float brightness-110"
                                onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/150?text=Box'; }}
                            />
                        </div>

                        <div className="mt-auto">
                            <div className="text-muted font-bold text-sm text-center mb-2">{box.price.toLocaleString()} GP</div>
                            <button className="w-full py-3 rounded-lg font-bold bg-gradient-to-r from-neon1 to-neon2 text-black opacity-90 group-hover:opacity-100 hover:brightness-110 transition-all text-xs uppercase tracking-wider">
                                Open Box
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {viewingBox && (
                <OddsModal 
                    box={viewingBox} 
                    items={viewingBoxItems} 
                    onClose={() => setViewingBox(null)} 
                />
            )}
        </div>
    );
};
