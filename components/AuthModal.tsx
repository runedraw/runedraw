import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';

interface AuthModalProps {
    onClose: () => void;
    onSuccess: () => void;
    initialMode: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess, initialMode }) => {
    const { refreshBalance } = useAuth();
    const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // New state to show the "Check Email" view
    const [verificationSent, setVerificationSent] = useState(false);
    
    // Resend Logic
    const [resendCooldown, setResendCooldown] = useState(0);

    // Timer for cooldown
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                // --- SIGN UP FLOW ---
                const redirectUrl = `${window.location.origin}/email-confirmed`;
                
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        emailRedirectTo: redirectUrl
                    }
                });
                if (error) throw error;
                
                // If signup successful but no user (shouldn't happen usually unless strict confirm)
                if (!data.user) {
                    throw new Error("Check your email for confirmation link.");
                }
                
                // Switch to verification view instead of alerting
                setVerificationSent(true);

            } else {
                // --- LOG IN FLOW ---
                const { error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });
                
                if (error) throw error;

                // Login successful
                await refreshBalance();
                onSuccess();
                onClose();
            }
        } catch (err: any) {
            console.error("Auth Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResendEmail = async () => {
        if (resendCooldown > 0) return;
        setLoading(true);
        try {
            const redirectUrl = `${window.location.origin}/email-confirmed`;
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: email,
                options: {
                    emailRedirectTo: redirectUrl
                }
            });
            if (error) throw error;
            
            setResendCooldown(60); // 60s cooldown
            alert("Verification email resent!");
        } catch (err: any) {
            console.error("Resend Error:", err);
            alert(err.message || "Failed to resend email.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const redirectUrl = `${window.location.origin}/email-confirmed`;
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'select_account consent',
                    },
                }
            });

            if (error) throw error;
            // Note: OAuth redirects the browser, so code execution stops here usually
        } catch (err: any) {
            console.error("Google Auth Error:", err);
            setError(err.message || "Failed to sign in with Google");
            setLoading(false);
        }
    };

    // --- RENDER: VERIFICATION SENT VIEW ---
    if (verificationSent) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="relative w-full max-w-md bg-[#0e1020] border-2 border-neon1 rounded-xl shadow-[0_0_50px_rgba(109,249,255,0.2)] overflow-hidden p-8 text-center">
                    <div className="w-16 h-16 mx-auto bg-neon1/10 rounded-full flex items-center justify-center mb-6 border border-neon1">
                        <span className="text-3xl">✉️</span>
                    </div>
                    
                    <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-4">
                        Check Your Inbox
                    </h2>
                    
                    <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                        We've sent a verification link to <span className="text-neon1 font-bold">{email}</span>.
                    </p>
                    
                    <p className="text-gray-500 text-xs mb-8">
                        Please click the link in the email to activate your account and start playing.
                    </p>

                    <div className="space-y-3">
                        <button 
                            onClick={onClose}
                            className="w-full py-3 font-bold text-black uppercase bg-neon1 rounded hover:bg-white transition-all shadow-[0_0_15px_rgba(109,249,255,0.3)]"
                        >
                            I've Confirmed It
                        </button>

                        <button 
                            onClick={handleResendEmail}
                            disabled={loading || resendCooldown > 0}
                            className="text-xs text-muted hover:text-white underline decoration-dashed underline-offset-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Sending...' : resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Didn\'t receive it? Resend Email'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER: LOGIN/SIGNUP FORM ---
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-md bg-[#0e1020] border border-[#2a2c45] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">
                
                {/* Header */}
                <div className="p-6 pb-0 text-center">
                    <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-2">
                        {isSignUp ? 'Join the Ranks' : 'Welcome Back'}
                    </h2>
                    <p className="text-muted text-xs">
                        {isSignUp ? 'Create an account to track your winnings.' : 'Enter your credentials to proceed.'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleAuth} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-red-200 text-xs font-bold text-center">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase">Email</label>
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-[#080a16] border border-[#2a2c45] rounded p-3 text-white focus:border-neon1 outline-none transition-colors"
                            placeholder="user@runedraw.com"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase">Password</label>
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#080a16] border border-[#2a2c45] rounded p-3 text-white focus:border-neon1 outline-none transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 mt-2 font-bold text-black uppercase bg-neon1 rounded hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
                    </button>
                    
                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-white/10"></div>
                        <span className="flex-shrink-0 mx-4 text-[10px] text-gray-500 font-bold uppercase">Or connect with</span>
                        <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    <button 
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full py-3 font-bold text-black uppercase bg-white rounded hover:bg-gray-200 transition-all text-xs flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"/>
                            <path d="M12 4.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Google
                    </button>

                    <div className="text-center mt-4">
                        <button 
                            type="button"
                            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                            className="text-xs text-muted hover:text-white underline decoration-dashed underline-offset-4"
                        >
                            {isSignUp ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
                        </button>
                    </div>
                </form>
                
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};