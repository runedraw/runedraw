
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import { UserProfileModal } from './UserProfileModal';
import { TopUpModal } from './TopUpModal';

export const Navbar: React.FC = () => {
    const { user, balance, login, signup, logout, refreshBalance } = useAuth();
    const location = useLocation();
    
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    const [showProfile, setShowProfile] = useState(false);
    const [profileTab, setProfileTab] = useState<'stats' | 'solo' | 'battle' | 'transactions'>('stats');
    
    const [showTopUp, setShowTopUp] = useState(false);
    
    // Mobile Menu State
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    // Deposit Notification
    const [depositNotification, setDepositNotification] = useState<{ amount: number } | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Payment Listener
    useEffect(() => {
        if (!user) return;

        // Listen for new transactions related to purchases
        const subscription = supabase
            .channel(`public:transaction_history:user_id=eq.${user.id}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'transaction_history', 
                filter: `user_id=eq.${user.id}` 
            }, (payload) => {
                const newTx = payload.new as any;
                // Check if it looks like a deposit (Positive amount + specific source keywords)
                // Sources like 'PURCHASE_STARTER', 'PURCHASE_WHALE', etc.
                if (newTx.amount > 0 && (newTx.source.includes('PURCHASE') || newTx.source === 'STRIPE_DEPOSIT')) {
                    refreshBalance(newTx.balance);
                    setDepositNotification({ amount: newTx.amount });
                    setTimeout(() => setDepositNotification(null), 5000);
                }
            })
            .subscribe();

        return () => { subscription.unsubscribe(); };
    }, [user]);

    const openProfile = (tab: 'stats' | 'solo' | 'battle' | 'transactions') => {
        setProfileTab(tab);
        setShowProfile(true);
        setIsDropdownOpen(false);
    };

    const handleLogout = () => {
        setIsDropdownOpen(false);
        logout();
    };

    const isActive = (path: string) => {
        return location.pathname.startsWith(path) ? 'text-white border-neon1' : 'text-muted border-transparent hover:text-white';
    };

    const mobileLinkClass = (path: string) => `block py-4 px-6 text-xl font-black uppercase tracking-widest border-b border-white/5 transition-colors ${location.pathname.startsWith(path) ? 'text-neon1 bg-white/5' : 'text-gray-400 hover:text-white'}`;

    const avatarUrl = user ? `https://api.dicebear.com/9.x/shapes/svg?seed=${user.id}&backgroundColor=0e1020` : '';

    return (
        <>
            <nav className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[#2a2c45] bg-[#0e1020]/95 backdrop-blur-md">
                {/* Left Section: Mobile Menu + Brand */}
                <div className="flex items-center gap-4">
                    {/* Mobile Menu Button (Visible on Mobile Only) */}
                    <button 
                        onClick={() => setMobileMenuOpen(true)}
                        className="lg:hidden text-white hover:text-neon1 transition-colors p-1"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    <Link to="/" className="flex items-center gap-1.5 sm:gap-2 text-lg sm:text-xl font-extrabold text-neon1">
                        <span className="text-neon3">◆</span> 
                        <span className="hidden xs:inline">RuneDraw</span>
                        <span className="text-[8px] bg-white/10 text-white px-1.5 py-0.5 rounded border border-white/10 align-top ml-1">v1.0</span>
                    </Link>
                </div>

                {/* Nav Links - Desktop (Hidden on Mobile) */}
                <div className="hidden lg:flex gap-8 items-center">
                    <Link to="/boxes" className={`px-1 py-2 text-xs font-bold uppercase border-b-2 transition-all tracking-widest ${isActive('/boxes')}`}>Boxes</Link>
                    <Link to="/battle" className={`px-1 py-2 text-xs font-bold uppercase border-b-2 transition-all tracking-widest ${isActive('/battle')}`}>Battles</Link>
                    <Link to="/games" className={`px-1 py-2 text-xs font-bold uppercase border-b-2 transition-all tracking-widest ${isActive('/games')}`}>Games</Link>
                    <Link to="/rewards" className={`px-1 py-2 text-xs font-bold uppercase border-b-2 transition-all tracking-widest ${isActive('/rewards')}`}>Rewards</Link>
                </div>

                {/* User Info / Auth - Right */}
                <div className="flex items-center justify-end gap-2 sm:gap-4 ml-2 sm:ml-4">
                    {user ? (
                        <div className="flex items-center gap-2 sm:gap-4">
                            {/* Balance Display */}
                            <div className="flex items-stretch bg-black/40 border border-[#2a2c45] rounded-md overflow-hidden relative group h-8 sm:h-9">
                                <div className="flex items-center gap-2 px-2 sm:px-3 bg-black/20">
                                    <span className="text-xs sm:text-sm font-bold text-white">{(balance || 0).toLocaleString()}</span>
                                    <span className="text-[8px] sm:text-[10px] font-bold text-muted uppercase mt-0.5">GP</span>
                                </div>
                                <button 
                                    onClick={() => setShowTopUp(true)}
                                    className="bg-neon1 hover:bg-white text-black px-3 flex items-center justify-center text-sm font-black transition-colors border-l border-black/20 leading-none pb-0.5"
                                    title="Add Funds"
                                >
                                    +
                                </button>
                                
                                {/* Deposit Notification Toast */}
                                {depositNotification && (
                                    <div className="absolute top-full right-0 mt-2 bg-[#0e1020] border border-green-500 rounded p-2 shadow-2xl animate-bounce-in min-w-[150px] z-50">
                                        <div className="text-[9px] text-gray-400 uppercase font-bold">Deposit Received</div>
                                        <div className="text-lg font-black text-green-400">+{depositNotification.amount.toLocaleString()} GP</div>
                                    </div>
                                )}
                            </div>

                            <div className="relative" ref={dropdownRef}>
                                <button 
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                                    className="flex items-center hover:opacity-80 transition-opacity focus:outline-none"
                                >
                                    <img 
                                        src={avatarUrl} 
                                        alt="User" 
                                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-neon1/50 bg-[#1a1d2e] shadow-[0_0_10px_rgba(109,249,255,0.2)]"
                                    />
                                </button>

                                {isDropdownOpen && (
                                    <div className="absolute right-0 mt-3 w-48 sm:w-52 bg-[#0e1020] border border-[#2a2c45] rounded-xl shadow-2xl overflow-hidden animate-fade-in z-[60]">
                                        <div className="p-3 sm:p-4 border-b border-[#2a2c45] bg-[#1a1d2e]">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Authenticated</p>
                                            <p className="text-[10px] sm:text-xs font-bold text-white truncate">{user.email}</p>
                                        </div>
                                        <div className="py-1">
                                            <button onClick={() => openProfile('stats')} className="w-full text-left px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold text-gray-300 hover:bg-white/5 hover:text-white transition-colors uppercase">Profile</button>
                                            <button onClick={() => openProfile('solo')} className="w-full text-left px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold text-gray-300 hover:bg-white/5 hover:text-white transition-colors uppercase">History</button>
                                        </div>
                                        <div className="border-t border-[#2a2c45] py-1">
                                            <button onClick={handleLogout} className="w-full text-left px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold text-red-400 hover:bg-white/5 uppercase">Sign Out</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 sm:gap-4">
                            <button onClick={login} className="text-[10px] sm:text-xs font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest">
                                Login
                            </button>
                            <button onClick={signup} className="px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-black bg-neon1 rounded hover:brightness-110 shadow-[0_0_10px_rgba(109,249,255,0.3)] uppercase tracking-widest">
                                Join
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-[100] bg-[#0e1020] animate-fade-in flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-[#2a2c45] bg-[#1a1d2e]">
                        <div className="flex items-center gap-3">
                            <span className="text-neon3 text-2xl">◆</span> 
                            <span className="text-xl font-black text-white italic tracking-wider">MENU</span>
                        </div>
                        <button 
                            onClick={() => setMobileMenuOpen(false)} 
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xl"
                        >
                            ✕
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_#1a1d2e_0%,_#0e1020_100%)]">
                        <Link to="/boxes" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass('/boxes')}>
                            📦 Boxes
                        </Link>
                        <Link to="/battle" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass('/battle')}>
                            ⚔️ Battles
                        </Link>
                        <Link to="/games" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass('/games')}>
                            🕹️ Arcade
                        </Link>
                        <Link to="/rewards" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass('/rewards')}>
                            🎁 Rewards
                        </Link>
                        
                        {/* New Features Section (Coming Soon) */}
                        <div className="mt-8 px-6">
                            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-4">Coming Soon</div>
                            <div className="space-y-3">
                                <div className="p-4 border border-dashed border-gray-700 bg-black/20 rounded-xl flex items-center gap-4 opacity-50 grayscale">
                                    <span className="text-2xl">🏆</span> 
                                    <div>
                                        <div className="font-bold text-gray-300 uppercase tracking-wider text-sm">Leaderboard</div>
                                        <div className="text-[10px] text-gray-600 font-bold uppercase">Global Rankings</div>
                                    </div>
                                </div>
                                <div className="p-4 border border-dashed border-gray-700 bg-black/20 rounded-xl flex items-center gap-4 opacity-50 grayscale">
                                    <span className="text-2xl">🤝</span> 
                                    <div>
                                        <div className="font-bold text-gray-300 uppercase tracking-wider text-sm">Marketplace</div>
                                        <div className="text-[10px] text-gray-600 font-bold uppercase">P2P Trading</div>
                                    </div>
                                </div>
                                <div className="p-4 border border-dashed border-gray-700 bg-black/20 rounded-xl flex items-center gap-4 opacity-50 grayscale">
                                    <span className="text-2xl">🏴</span> 
                                    <div>
                                        <div className="font-bold text-gray-300 uppercase tracking-wider text-sm">Syndicates</div>
                                        <div className="text-[10px] text-gray-600 font-bold uppercase">Clan System</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6 border-t border-[#2a2c45] bg-[#0e1020]">
                        <button 
                            onClick={() => {
                                setMobileMenuOpen(false);
                                if (user) logout(); else login();
                            }}
                            className="w-full py-4 border border-[#2a2c45] bg-[#1a1d2e] text-gray-400 font-black uppercase tracking-widest rounded-xl hover:bg-white hover:text-black transition-all shadow-lg"
                        >
                            {user ? 'Log Out' : 'Log In'}
                        </button>
                    </div>
                </div>
            )}

            {showProfile && <UserProfileModal initialTab={profileTab} onClose={() => setShowProfile(false)} />}
            {showTopUp && <TopUpModal onClose={() => setShowTopUp(false)} />}
        </>
    );
};
