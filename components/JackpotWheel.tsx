
import React, { useEffect, useState, useRef } from 'react';
import { playTickSound, playWinSound } from '../constants';

interface WheelSegment {
    id: number;
    label: string;
    weight: number;
    color: string;
    textColor: string;
}

interface JackpotWheelProps {
    segments: WheelSegment[];
    winnerId: number; // Winner Team ID
    onComplete: () => void;
}

export const JackpotWheel: React.FC<JackpotWheelProps> = ({ segments, winnerId, onComplete }) => {
    const [isSpinning, setIsSpinning] = useState(false);
    const wheelRef = useRef<HTMLDivElement>(null);
    
    // Normalize weights to percentages
    const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
    const normalizedSegments = segments.map(s => ({
        ...s,
        percent: s.weight / totalWeight,
        degrees: (s.weight / totalWeight) * 360
    }));

    // Animation Refs
    const animRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const startRotationRef = useRef<number>(0);
    const targetRotationRef = useRef<number>(0);
    const lastSegmentIndexRef = useRef<number>(-1);

    useEffect(() => {
        // Start spin after mount
        const timer = setTimeout(() => {
            handleSpin();
        }, 500);
        return () => {
            clearTimeout(timer);
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, []);

    const getSegmentIndexAtRotation = (rot: number) => {
        // Wheel rotates clockwise. Pointer is at 0 (top).
        // The angle of the wheel under the pointer is effectively moving backwards.
        // Normalized angle = (360 - (rot % 360)) % 360
        const angle = (360 - (rot % 360)) % 360;
        
        let current = 0;
        for (let i = 0; i < normalizedSegments.length; i++) {
            const end = current + normalizedSegments[i].degrees;
            if (angle >= current && angle < end) {
                return i;
            }
            current = end;
        }
        return 0;
    };

    const easeOutQuart = (x: number): number => {
        return 1 - Math.pow(1 - x, 4);
    };

    const animate = (time: number) => {
        if (!startTimeRef.current) startTimeRef.current = time;
        const elapsed = time - startTimeRef.current;
        const duration = 6500; // 6.5s spin

        const progress = Math.min(elapsed / duration, 1);
        const ease = easeOutQuart(progress);
        
        const currentRotation = startRotationRef.current + (targetRotationRef.current - startRotationRef.current) * ease;

        // Apply rotation
        if (wheelRef.current) {
            wheelRef.current.style.transform = `rotate(${currentRotation}deg)`;
        }

        // Check for Tick
        const currentIndex = getSegmentIndexAtRotation(currentRotation);
        if (currentIndex !== lastSegmentIndexRef.current && progress < 1) {
            playTickSound();
            lastSegmentIndexRef.current = currentIndex;
        }

        if (progress < 1) {
            animRef.current = requestAnimationFrame(animate);
        } else {
            // Finish
            playWinSound();
            onComplete();
        }
    };

    const handleSpin = () => {
        if (isSpinning) return;
        setIsSpinning(true);

        // 1. Calculate Winner Position
        let accumulatedDegrees = 0;
        let winnerStart = 0;
        let winnerEnd = 0;

        for (const seg of normalizedSegments) {
            if (seg.id === winnerId) {
                winnerStart = accumulatedDegrees;
                winnerEnd = accumulatedDegrees + seg.degrees;
                break;
            }
            accumulatedDegrees += seg.degrees;
        }

        // 2. Determine target angle to land winner at Top (0 deg)
        const winnerCenter = winnerStart + (winnerEnd - winnerStart) / 2;
        // Add random jitter (80% of segment width)
        const jitterRange = (winnerEnd - winnerStart) * 0.8; 
        const randomJitter = (Math.random() - 0.5) * jitterRange;
        
        const targetAngleOnWheel = winnerCenter + randomJitter;
        
        // 3. Calculate full rotations
        const spins = 10; // More spins for dramatic effect
        const fullRotations = 360 * spins;
        
        // Target Rotation Logic:
        // We want (FinalRot % 360) such that the pointer (at 0) is over targetAngleOnWheel.
        // Pointer Angle = (360 - (Rot % 360)) % 360
        // We want Pointer Angle = targetAngleOnWheel
        // => targetAngleOnWheel = 360 - (Rot % 360)
        // => (Rot % 360) = 360 - targetAngleOnWheel
        
        const finalRotation = fullRotations + (360 - targetAngleOnWheel);
        
        startRotationRef.current = 0;
        targetRotationRef.current = finalRotation;
        startTimeRef.current = 0;
        lastSegmentIndexRef.current = getSegmentIndexAtRotation(0);

        animRef.current = requestAnimationFrame(animate);
    };

    // Helper to create SVG arcs
    const getCoordinatesForPercent = (percent: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    let cumulativePercent = 0;

    return (
        <div className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center">
            {/* Pointer (Needle) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 z-20">
                <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[24px] border-t-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
            </div>

            {/* Wheel Container */}
            <div 
                ref={wheelRef}
                className="w-full h-full rounded-full border-4 border-[#2a2c45] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative bg-[#0e1020]"
                // Removed CSS transition to allow JS loop control
            >
                <svg viewBox="-1 -1 2 2" className="w-full h-full transform -rotate-90">
                    {normalizedSegments.map((segment) => {
                        const start = getCoordinatesForPercent(cumulativePercent);
                        cumulativePercent += segment.percent;
                        const end = getCoordinatesForPercent(cumulativePercent);
                        const largeArcFlag = segment.percent > 0.5 ? 1 : 0;
                        const pathData = [
                            `M ${start[0]} ${start[1]}`,
                            `A 1 1 0 ${largeArcFlag} 1 ${end[0]} ${end[1]}`,
                            `L 0 0`,
                        ].join(' ');

                        return (
                            <path 
                                key={segment.id} 
                                d={pathData} 
                                fill={segment.color} 
                                stroke="#0e1020" 
                                strokeWidth="0.02" 
                            />
                        );
                    })}
                </svg>
                
                {/* Labels Overlay (Rotated with wheel) */}
                <div className="absolute inset-0">
                    {(() => {
                        let currentDeg = 0;
                        return normalizedSegments.map(seg => {
                            const centerAngle = currentDeg + (seg.degrees / 2);
                            currentDeg += seg.degrees;
                            return (
                                <div 
                                    key={seg.id}
                                    className="absolute top-1/2 left-1/2 origin-left flex items-center"
                                    style={{ 
                                        width: '50%', 
                                        height: '0px',
                                        transform: `rotate(${centerAngle - 90}deg)` // -90 to align with SVG start at top
                                    }}
                                >
                                    <div 
                                        className="pl-8 sm:pl-12 font-black uppercase text-[10px] sm:text-xs tracking-wider truncate max-w-[80%] drop-shadow-md"
                                        style={{ color: seg.textColor }}
                                    >
                                        <span className="bg-black/40 px-1 py-0.5 rounded backdrop-blur-sm">
                                            {(seg.percent * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            )
                        });
                    })()}
                </div>
            </div>

            {/* Central Hub */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-[#1a1d2e] rounded-full border-4 border-white/10 z-10 shadow-[0_0_20px_rgba(0,0,0,0.8)] flex items-center justify-center">
                <div className="text-2xl animate-pulse">🏆</div>
            </div>
        </div>
    );
};
