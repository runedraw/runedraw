import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

export const EmailConfirmed: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(true);

    // Parse the URL to see if we have a token (Supabase Implicit) OR a code (Supabase PKCE)
    const hasHash = window.location.hash.includes('access_token') || window.location.hash.includes('error');
    const hasCode = window.location.search.includes('code=');

    useEffect(() => {
        // If we have a user, we are done
        if (user) {
            setIsProcessing(false);
            return;
        }

        // If no user yet, but we have authentication params, wait for App.tsx to handle the exchange
        if (hasHash || hasCode) {
            const timer = setTimeout(() => {
                // If still processing after 4 seconds, allow the UI to show failure state
                // (The App.tsx auth listener handles the actual state update)
                setIsProcessing(false);
            }, 4000);
            return () => clearTimeout(timer);
        } else {
            // No tokens, no user -> probably just landed here manually
            setIsProcessing(false);
        }
    }, [user, hasHash, hasCode]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 animate-fade-in relative">
            {/* Background Flair */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-green-500/10 via-transparent to-transparent opacity-30 pointer-events-none"></div>

            {isProcessing ? (
                // LOADING STATE
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-neon1 border-t-transparent rounded-full animate-spin mb-6"></div>
                    <h2 className="text-2xl font-bold text-white uppercase tracking-wider animate-pulse">
                        Verifying Identity...
                    </h2>
                    <p className="text-xs text-muted mt-2">Exchanging security keys</p>
                </div>
            ) : user ? (
                // SUCCESS STATE (User exists)
                <>
                    <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border-2 border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.3)] animate-pulse-glow">
                        <span className="text-4xl text-green-400">✓</span>
                    </div>
                    
                    <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-wider mb-4 drop-shadow-lg">
                        Access Granted
                    </h1>
                    
                    <p className="text-gray-300 text-lg max-w-md mb-8 leading-relaxed">
                        Welcome back, Agent. Your credentials have been verified. You now have full clearance to the terminal.
                    </p>

                    <Link 
                        to="/lobby" 
                        className="px-10 py-4 bg-neon1 text-black font-black text-lg uppercase rounded hover:scale-105 transition-transform shadow-[0_0_20px_rgba(109,249,255,0.4)] hover:bg-white"
                    >
                        Enter Lobby
                    </Link>
                </>
            ) : (
                // ERROR / MANUAL NAVIGATION STATE (No user, hash processed or invalid)
                <>
                     <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.3)]">
                        <span className="text-4xl text-red-400">?</span>
                    </div>
                    
                    <h1 className="text-3xl font-black text-white uppercase tracking-wider mb-4">
                        Verification Pending
                    </h1>
                    
                    <p className="text-gray-300 max-w-md mb-8">
                        We couldn't detect your login session yet. Please click the link in your email again, or try logging in manually.
                    </p>

                    <button 
                        onClick={() => navigate('/')} 
                        className="px-8 py-3 bg-white/10 text-white font-bold uppercase rounded border border-white/20 hover:bg-white hover:text-black transition-all"
                    >
                        Back to Home
                    </button>
                </>
            )}
        </div>
    );
};