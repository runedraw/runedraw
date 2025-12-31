
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameService } from '../services/gameService';
import { getItemImageUrl } from '../constants';
import { BoxItem } from '../types';

export const ImageAudit: React.FC = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'idle' | 'scanning' | 'complete'>('idle');
    const [progress, setProgress] = useState(0);
    const [found, setFound] = useState<any[]>([]);
    const [missing, setMissing] = useState<any[]>([]);
    const [total, setTotal] = useState(0);

    const startAudit = async () => {
        setStatus('scanning');
        setFound([]);
        setMissing([]);
        setProgress(0);

        try {
            // Fetch all items from DB
            const allItemsMap = await GameService.getAllBoxItems();
            
            // Flatten and Deduplicate by Name
            const uniqueItems = new Map<string, BoxItem>();
            Object.values(allItemsMap).forEach(list => {
                list.forEach(item => uniqueItems.set(item.name, item));
            });
            
            const itemsToCheck = Array.from(uniqueItems.values()).sort((a,b) => a.name.localeCompare(b.name));
            setTotal(itemsToCheck.length);

            let completedCount = 0;

            // Batch processing to avoid browser limit limits
            const BATCH_SIZE = 10;
            for (let i = 0; i < itemsToCheck.length; i += BATCH_SIZE) {
                const batch = itemsToCheck.slice(i, i + BATCH_SIZE);
                
                await Promise.all(batch.map(item => new Promise<void>((resolve) => {
                    // item.image is already populated with auto-generated name by GameService if DB was null
                    const url = getItemImageUrl(item.image || '');
                    
                    const img = new Image();
                    img.onload = () => {
                        setFound(prev => [...prev, { name: item.name, filename: item.image, url }]);
                        completedCount++;
                        updateProgress(completedCount, itemsToCheck.length);
                        resolve();
                    };
                    img.onerror = () => {
                        setMissing(prev => [...prev, { name: item.name, filename: item.image, url }]);
                        completedCount++;
                        updateProgress(completedCount, itemsToCheck.length);
                        resolve();
                    };
                    img.src = url;
                })));
            }
            setStatus('complete');

        } catch (e) {
            console.error(e);
            alert("Audit failed to start");
            setStatus('idle');
        }
    };

    const updateProgress = (current: number, total: number) => {
        setProgress(Math.floor((current / total) * 100));
    };

    return (
        <div className="container mx-auto p-6 max-w-6xl min-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Asset Audit Terminal</h1>
                    <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Storage Validation Protocol</p>
                </div>
                <button onClick={() => navigate('/')} className="text-xs font-bold text-gray-500 hover:text-white uppercase">Exit Terminal</button>
            </div>

            {/* Controls */}
            <div className="bg-[#0e1020] border border-[#2a2c45] p-6 rounded-2xl shadow-xl mb-8">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={startAudit} 
                        disabled={status === 'scanning'}
                        className={`
                            px-8 py-3 bg-neon1 text-black font-black uppercase text-sm rounded-xl 
                            ${status === 'scanning' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 transition-transform'}
                        `}
                    >
                        {status === 'scanning' ? 'Scanning...' : 'Start Audit'}
                    </button>

                    <div className="flex-1">
                        <div className="flex justify-between text-xs font-bold uppercase mb-2">
                            <span className="text-gray-400">Progress</span>
                            <span className="text-white">{progress}%</span>
                        </div>
                        <div className="h-4 bg-black rounded-full border border-white/10 overflow-hidden">
                            <div className="h-full bg-neon1 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                </div>
                
                {status !== 'idle' && (
                    <div className="flex gap-4 mt-6 text-center">
                        <div className="flex-1 bg-black/40 p-3 rounded-lg border border-white/5">
                            <div className="text-[10px] text-gray-500 uppercase font-bold">Items Checked</div>
                            <div className="text-xl font-bold text-white">{found.length + missing.length} / {total}</div>
                        </div>
                        <div className="flex-1 bg-green-900/20 p-3 rounded-lg border border-green-500/20">
                            <div className="text-[10px] text-green-400 uppercase font-bold">Images Found</div>
                            <div className="text-xl font-bold text-green-400">{found.length}</div>
                        </div>
                        <div className="flex-1 bg-red-900/20 p-3 rounded-lg border border-red-500/20">
                            <div className="text-[10px] text-red-400 uppercase font-bold">Missing Images</div>
                            <div className="text-xl font-bold text-red-500">{missing.length}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* MISSING LIST */}
                <div className="bg-[#0e1020] border-2 border-red-500/30 rounded-2xl overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 bg-red-500/10 border-b border-red-500/30 flex justify-between items-center">
                        <h2 className="text-lg font-black text-red-500 uppercase">Missing Assets</h2>
                        <span className="text-xs font-bold bg-red-500 text-black px-2 py-1 rounded">{missing.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {missing.map((item, i) => (
                            <div key={i} className="flex flex-col p-3 bg-black/40 border border-white/5 rounded hover:bg-red-500/10 transition-colors">
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-white text-sm">{item.name}</span>
                                    <span className="text-[10px] text-red-400 font-mono">404</span>
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono mt-1 break-all">
                                    Expected: <span className="text-gray-300 select-all">{item.filename}</span>
                                </div>
                            </div>
                        ))}
                        {missing.length === 0 && status === 'complete' && (
                            <div className="p-10 text-center text-gray-500 italic">No missing images found!</div>
                        )}
                    </div>
                </div>

                {/* FOUND LIST */}
                <div className="bg-[#0e1020] border-2 border-green-500/30 rounded-2xl overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 bg-green-500/10 border-b border-green-500/30 flex justify-between items-center">
                        <h2 className="text-lg font-black text-green-500 uppercase">Verified Assets</h2>
                        <span className="text-xs font-bold bg-green-500 text-black px-2 py-1 rounded">{found.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {found.map((item, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 bg-black/40 border border-white/5 rounded hover:bg-green-500/10 transition-colors">
                                <div className="w-10 h-10 bg-black/50 rounded flex items-center justify-center shrink-0">
                                    <img src={item.url} className="w-full h-full object-contain brightness-125" alt="" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-white text-xs truncate">{item.name}</div>
                                    <div className="text-[9px] text-gray-500 font-mono truncate">{item.filename}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};
