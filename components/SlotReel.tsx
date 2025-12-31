
import React, { useEffect, useRef, useState } from 'react';
import { TIER_COLORS, getItemImageUrl, playTickSound, playWinSound, playGoldTeaseSound, GOLD_TEASE_ICON } from '../constants';
import { SpinResult, BoxItem } from '../types';

interface SlotReelProps {
    spinning: boolean; // True = Infinite Spin, False = Check for result
    result: SpinResult | null; // If present AND spinning=false, stop at this result
    pool: BoxItem[]; 
    isVertical?: boolean;
    onStop?: () => void;
    disableTease?: boolean; // New prop to disable legendary tease mechanic
    compact?: boolean; // New prop for smaller items
}

interface RenderItem {
    name: string;
    tier: string;
    icon: string;
    id: string; 
    isPlaceholder?: boolean;
    payout?: number; // Added to track specific win value on the item
}

export const SlotReel: React.FC<SlotReelProps> = ({ spinning, result, pool, isVertical = false, onStop, disableTease = false, compact = false }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const safetyTimeoutRef = useRef<any>(null);
    
    // State to track the Tease Mechanic (for Red/Gold items)
    const hasTeasedRef = useRef(false);
    
    // Mutable pool ref allows us to switch to "High Tier Only" pool mid-animation
    const activePoolRef = useRef<BoxItem[]>(pool);

    // Strict Reset: When pool prop changes, update internal ref immediately to prevent stale items
    useEffect(() => {
        activePoolRef.current = pool;
        // If we are idle, regenerate the strip to show new box items immediately
        if (physics.current.state === 'IDLE') {
            itemsRef.current = generateStrip(pool, 25);
            physics.current.position = 0;
            forceUpdate();
        }
    }, [pool]);

    // Use a ref for onStop to avoid stale closures in the animation loop
    const onStopRef = useRef(onStop);
    useEffect(() => {
        onStopRef.current = onStop;
    }, [onStop]);

    // Items state
    const itemsRef = useRef<RenderItem[]>([]);
    const [_, setTick] = useState(0); 
    const forceUpdate = () => setTick(t => t + 1);

    const physics = useRef({
        position: 0,
        speed: 0,
        targetPosition: -1,
        startPosition: 0, // For easing
        stopStartTime: 0, // For easing
        stopDuration: 0,  // For easing
        state: 'IDLE' as 'IDLE' | 'ACCELERATING' | 'SPINNING' | 'STOPPING' | 'DONE',
        animationId: 0,
        lastFrameTime: 0
    });

    // Determine Size based on Compact Mode
    // Normal Vertical: 80px, Compact Vertical: 60px
    const ITEM_SIZE = isVertical ? (compact ? 60 : 80) : 130; 
    
    // --- 1. Initialization ---
    useEffect(() => {
        // Reset tease status on new spin command
        if (spinning) {
            hasTeasedRef.current = false;
            activePoolRef.current = pool; // Reset to full pool
        }

        if (itemsRef.current.length === 0) {
            // Initial fill
            const baseItems = generateStrip(activePoolRef.current, 25);
            itemsRef.current = baseItems;
            physics.current.position = 0;
            forceUpdate();
        }
        return () => {
            if (physics.current.animationId) {
                cancelAnimationFrame(physics.current.animationId);
            }
            if (safetyTimeoutRef.current) {
                clearTimeout(safetyTimeoutRef.current);
            }
        };
    }, [spinning]);

    // --- 2. Control Logic ---
    useEffect(() => {
        // Condition A: Start Infinite Spin
        if (spinning && !result) {
            startSpin();
        } 
        // Condition B: Stop Sequence
        else if (result && !spinning) {
            // Force start if idle (e.g. very fast API response or first render with result)
            if (physics.current.state === 'IDLE' || physics.current.state === 'DONE') {
                 // Initialize spin state first
                 startSpin();
                 // We need to wait for at least one frame/tick so startSpin initializes correctly
                 setTimeout(() => startStopSequence(result), 50);
            } else if (physics.current.state !== 'STOPPING') {
                 // Transition immediately
                 startStopSequence(result);
            }
        }
    }, [spinning, result]);

    // --- HELPER: Weighted Random Selection ---
    const getWeightedRandomItem = (sourcePool: BoxItem[]): BoxItem => {
        if (!sourcePool || sourcePool.length === 0) return { name: 'Mystery', tier: 'gray', value: 0 };
        
        // Calculate total weight
        const totalWeight = sourcePool.reduce((sum, item) => sum + (item.weight || 100), 0);
        let random = Math.random() * totalWeight;
        
        for (const item of sourcePool) {
            const w = item.weight || 100;
            if (random < w) return item;
            random -= w;
        }
        return sourcePool[0];
    };

    const generateStrip = (sourcePool: BoxItem[], count: number): RenderItem[] => {
        return Array.from({ length: count }).map(() => {
            const item = getWeightedRandomItem(sourcePool);
            
            let displayName = item.name;
            // Use image from DB if available, strictly rely on images or placeholder
            let displayIcon = item.image ? getItemImageUrl(item.image) : ''; 
            // Fallback for missing image path: GameService ensures item.image is populated now.
            
            let displayTier = item.tier;

            // Only apply tease logic if NOT disabled
            if (!disableTease) {
                const t = item.tier.toLowerCase();
                const isHighTier = t === 'gold' || t === 'red';

                if (isHighTier && !hasTeasedRef.current) {
                    displayIcon = GOLD_TEASE_ICON;
                    displayName = "LEGENDARY";
                    displayTier = 'gold'; 
                }
            }
            
            const uniqueKey = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            return {
                name: displayName,
                tier: displayTier,
                icon: displayIcon,
                id: uniqueKey,
                isPlaceholder: !disableTease && (item.tier === 'gold' || item.tier === 'red') && !hasTeasedRef.current
            };
        });
    };

    const startSpin = () => {
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        
        if (physics.current.animationId) {
            cancelAnimationFrame(physics.current.animationId);
        }

        if (physics.current.state === 'DONE' || itemsRef.current.length > 100) {
            physics.current.position = 0;
            itemsRef.current = generateStrip(activePoolRef.current, 30);
            forceUpdate();
        }

        physics.current.state = 'ACCELERATING';
        physics.current.targetPosition = -1;
        physics.current.speed = 0; 
        physics.current.stopStartTime = 0;
        
        physics.current.lastFrameTime = performance.now();
        physics.current.animationId = requestAnimationFrame(loop);
    };

    const startStopSequence = (winResult: SpinResult) => {
        if (physics.current.state === 'STOPPING') {
            if (!physics.current.animationId) {
                 physics.current.lastFrameTime = performance.now();
                 physics.current.animationId = requestAnimationFrame(loop);
            }
            return;
        }

        physics.current.state = 'STOPPING';
        physics.current.stopStartTime = 0;
        
        // --- TEASE LOGIC ---
        let targetItem: RenderItem;
        const resTier = winResult.tier.toLowerCase();
        const isHighTierResult = resTier === 'gold' || resTier === 'red';

        // Apply tease logic ONLY if not disabled
        if (!disableTease && isHighTierResult && !hasTeasedRef.current) {
            targetItem = {
                name: 'LEGENDARY',
                tier: 'gold', 
                icon: GOLD_TEASE_ICON,
                id: 'TEASE-' + Date.now(),
                isPlaceholder: true
            };
        } else {
            // Target the REAL item
            let iconUrl = winResult.item_icon;
            
            targetItem = {
                name: winResult.item_name,
                tier: winResult.tier,
                icon: iconUrl || '',
                id: 'WINNER-' + Date.now(),
                payout: winResult.payout // Attach payout here
            };
        }

        const DECEL_ITEMS = 7; 
        const BUFFER_ITEMS = 3;
        
        const decelStrip = generateStrip(activePoolRef.current, DECEL_ITEMS);
        const bufferStrip = generateStrip(activePoolRef.current, BUFFER_ITEMS);
        
        const currentCount = itemsRef.current.length;
        itemsRef.current = [...itemsRef.current, ...decelStrip, targetItem, ...bufferStrip];
        forceUpdate();
        
        let containerSize = 0;
        if (containerRef.current) {
            containerSize = isVertical ? containerRef.current.clientHeight : containerRef.current.clientWidth;
        }

        const winnerIndex = currentCount + DECEL_ITEMS;
        const winnerCenter = (winnerIndex * ITEM_SIZE) + (ITEM_SIZE / 2);
        
        physics.current.targetPosition = winnerCenter - (containerSize / 2);

        if (physics.current.animationId) cancelAnimationFrame(physics.current.animationId);
        physics.current.lastFrameTime = performance.now();
        physics.current.animationId = requestAnimationFrame(loop);

        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = setTimeout(() => {
            if (physics.current.state !== 'DONE') {
                finishSpin();
            }
        }, 12000); 
    };

    const loop = (time: number) => {
        try {
            const p = physics.current;
            const dt = Math.min((time - p.lastFrameTime) / 16.67, 2); 
            p.lastFrameTime = time;

            const MAX_SPEED = isVertical ? (compact ? 12 : 14) : 18;
            const ACCEL = 0.5 * dt; 

            if (p.state === 'ACCELERATING') {
                p.speed += ACCEL;
                if (p.speed >= MAX_SPEED) {
                    p.speed = MAX_SPEED;
                    p.state = 'SPINNING';
                }
                ensureTrackLength();
                p.position += p.speed * dt;
            } 
            else if (p.state === 'SPINNING') {
                p.speed = MAX_SPEED;
                ensureTrackLength();
                p.position += p.speed * dt;
            }
            else if (p.state === 'STOPPING') {
                if (!p.stopStartTime) {
                    p.stopStartTime = time;
                    p.startPosition = p.position;
                    const dist = p.targetPosition - p.startPosition;
                    const currentSpeedPxPerMs = p.speed / 16.67; 
                    const safeSpeed = Math.max(currentSpeedPxPerMs, 0.1); 
                    const N = 5; 
                    p.stopDuration = (dist * N) / safeSpeed;
                    p.stopDuration = Math.min(Math.max(p.stopDuration, 2000), 6000);
                }

                const elapsed = time - p.stopStartTime;
                const progress = Math.min(1, elapsed / p.stopDuration);
                const ease = 1 - Math.pow(1 - progress, 5);
                const totalDist = p.targetPosition - p.startPosition;
                const newPos = p.startPosition + (totalDist * ease);
                
                p.speed = newPos - p.position;
                p.position = newPos;

                if (progress >= 1) {
                    finishSpin();
                    return;
                }
            }

            const currentTick = Math.floor(p.position / ITEM_SIZE);
            const prevTick = Math.floor((p.position - p.speed) / ITEM_SIZE); 

            if (currentTick > prevTick && p.state !== 'DONE') {
                playTickSound();
            }

            updateDOM();

            if (p.state !== 'DONE') {
                p.animationId = requestAnimationFrame(loop);
            }
        } catch (e) {
            finishSpin(); 
        }
    };

    const ensureTrackLength = () => {
        const viewEnd = physics.current.position + 1000;
        const stripLen = itemsRef.current.length * ITEM_SIZE;
        
        if (stripLen - viewEnd < 2000) {
            itemsRef.current = [...itemsRef.current, ...generateStrip(activePoolRef.current, 20)];
            forceUpdate();
        }
    };
    
    const finishSpin = () => {
        const p = physics.current;
        p.position = p.targetPosition;
        p.speed = 0;
        p.state = 'DONE';
        p.animationId = 0;
        
        // Force update to ensure the render pass sees 'DONE' state for the payout badge
        forceUpdate(); 
        updateDOM();
        
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        
        const resTier = result?.tier.toLowerCase() || '';
        const isHighTier = resTier === 'gold' || resTier === 'red';

        if (!disableTease && isHighTier && !hasTeasedRef.current) {
            hasTeasedRef.current = true;
            const highTierItems = pool.filter(i => {
                const t = i.tier.toLowerCase();
                return t === 'gold' || t === 'red';
            });

            if (highTierItems.length > 0) {
                activePoolRef.current = highTierItems;
            }
            playGoldTeaseSound();
            
            setTimeout(() => {
                startSpin();
                setTimeout(() => {
                    startStopSequence(result!);
                }, 800); 
            }, 800); 
            return; 
        }

        playWinSound();
        if (onStopRef.current) {
            onStopRef.current();
        }
    };

    const updateDOM = () => {
        if (trackRef.current) {
            const axis = isVertical ? 'Y' : 'X';
            trackRef.current.style.transform = `translate${axis}(-${physics.current.position.toFixed(2)}px) translateZ(0)`;
        }
    };

    return (
        <div ref={containerRef} className={`relative overflow-hidden bg-[#16192b] border border-[#2a2c45] rounded-xl shadow-inner ${isVertical ? 'h-full w-full' : 'w-full h-[160px]'}`}>
            <div className={`absolute z-20 bg-yellow-400 shadow-[0_0_15px_#ffd700] pointer-events-none opacity-80
                ${isVertical ? 'h-[2px] w-full top-1/2 -translate-y-1/2 left-0' : 'w-[2px] h-[80%] top-[10%] left-1/2 -translate-x-1/2'}
            `}></div>
            
            <div 
                ref={trackRef}
                className={`flex ${isVertical ? 'flex-col items-center w-full' : 'flex-row items-center'} absolute top-0 left-0 will-change-transform`}
            >
                {itemsRef.current.map((item) => {
                    // Detect if icon is an Image URL
                    const isImage = item.icon.includes('/') || item.icon.startsWith('data:');
                    const isDone = physics.current.state === 'DONE';
                    
                    return (
                    <div 
                        key={item.id} 
                        className={`
                            flex-shrink-0 flex flex-col items-center justify-center 
                            border rounded-lg bg-[#1a1d2e] relative overflow-hidden
                            ${item.isPlaceholder ? 'animate-pulse' : ''}
                        `}
                        style={{ 
                            width: isVertical ? '90%' : `${ITEM_SIZE - 5}px`,
                            height: isVertical ? (compact ? '55px' : '70px') : `${ITEM_SIZE - 5}px`,
                            marginRight: isVertical ? 0 : '5px',
                            marginBottom: isVertical ? (compact ? '5px' : '10px') : 0,
                            borderColor: TIER_COLORS[item.tier] || '#333',
                            // Updated Glow Logic for Team Colors
                            boxShadow: TIER_COLORS[item.tier]
                                ? `0 0 15px ${TIER_COLORS[item.tier]}40` 
                                : 'none'
                        }}
                    >
                        {/* Name - Only show when done (hit) */}
                        {isDone && (
                             <div className="absolute top-0 inset-x-0 bg-black/80 backdrop-blur-[2px] py-0.5 z-20 border-b border-white/10">
                                <div className="text-[8px] font-bold text-center text-gray-200 truncate px-1 leading-tight">
                                    {item.name}
                                </div>
                            </div>
                        )}

                        {/* Image/Icon - Centered and Adaptive */}
                        <div className={`
                            w-full h-full flex items-center justify-center p-2
                            ${item.isPlaceholder ? 'text-neon3' : ''}
                            ${!isImage ? (isVertical ? (compact ? 'text-2xl' : 'text-3xl') : 'text-5xl') : ''}
                        `}>
                            {isImage ? (
                                <img 
                                    src={item.icon} 
                                    alt={item.name} 
                                    className="w-full h-full object-contain drop-shadow-md brightness-125" 
                                />
                            ) : (
                                item.icon
                            )}
                        </div>
                        
                        {/* Payout Display - Embedded inside the winning item box */}
                        {item.payout !== undefined && isDone && (
                            <div className="absolute inset-x-0 bottom-0 bg-black/80 backdrop-blur-sm py-0.5 border-t border-white/10 animate-slide-in-up z-20">
                                <div className="text-[10px] font-black text-center" style={{ color: TIER_COLORS[item.tier] || '#fff' }}>
                                    +{item.payout.toLocaleString()}
                                </div>
                            </div>
                        )}
                    </div>
                )})}
            </div>
        </div>
    );
};
