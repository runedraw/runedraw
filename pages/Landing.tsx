
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';

export const Landing: React.FC = () => {
    const { user, signup } = useAuth();

    return (
        <div className="flex flex-col items-center justify-center min-h-[90vh] text-center px-4 relative overflow-hidden">
             {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neon1/10 via-transparent to-transparent opacity-50 pointer-events-none"></div>

            <div className="w-48 h-48 border-4 border-neon1 rounded-full flex items-center justify-center mb-12 shadow-[0_0_50px_rgba(109,249,255,0.2)] animate-pulse-glow">
                <div className="text-6xl text-neon1 animate-spin-slow">✦</div>
            </div>

            <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-[#9bb3ff]">
                FORGE YOUR<br/>DESTINY
            </h1>
            
            <p className="text-muted text-lg max-w-lg mb-8 leading-relaxed">
                Enter the mystical archive. Unlock legendary artifacts, test your luck against the odds, and battle for supremacy.
            </p>

            {!user && (
                <div className="mb-10">
                     <button onClick={signup} className="px-10 py-4 bg-gradient-to-r from-neon1 to-blue-500 text-black font-black text-xl rounded uppercase tracking-widest hover:scale-105 transition-transform shadow-[0_0_30px_rgba(109,249,255,0.4)]">
                        Create Free Account
                    </button>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-6">
                <Link to="/boxes" className="px-8 py-4 bg-black/40 border border-neon1/50 text-white font-extrabold text-lg rounded-full shadow-[0_0_20px_rgba(109,249,255,0.1)] hover:-translate-y-1 hover:bg-neon1 hover:text-black transition-all">
                    Open Boxes
                </Link>
                <Link to="/battle" className="px-8 py-4 bg-black/30 border border-white/20 text-white font-extrabold text-lg rounded-full hover:bg-white/10 hover:border-white transition-all">
                    PVP Battles
                </Link>
            </div>
        </div>
    );
};
