
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { UserProfileModal } from './UserProfileModal';

export const Navbar: React.FC = () => {
    const { user, balance, login, signup, logout } = useAuth();
    const location = useLocation();
    
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    const [showProfile, setShowProfile] = useState(false);
    const [profileTab, setProfileTab] = useState<'stats' | 'solo' | 'battle' | 'transactions'>('stats');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    const avatarUrl = user ? `https://api.dicebear.com/9.x/shapes/svg?seed=${user.id}&backgroundColor=0e1020` : '';

    return (
        <>
            <nav className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[#2a2c45] bg-[#0e1020]/95 backdrop-blur-md">
                {/* Brand - Left */}
                <div className="flex-shrink-0 mr-2 sm:mr-4">
                    <Link to="/" className="flex items-center gap-1.5 sm:gap-2 text-lg sm:text-xl font-extrabold text-neon1">
                        <span className="text-neon3">◆</span> 
                        <span className="hidden xs:inline">RuneDraw</span>
                    </Link>
                </div>

                {/* Nav Links - Center (Now visible on all sizes) */}
                <div className="flex gap-3 sm:gap-8 items-center">
                    <Link to="/boxes" className={`px-0.5 sm:px-1 py-1 sm:py-2 text-[10px] sm:text-xs font-bold uppercase border-b-2 transition-all tracking-tighter sm:tracking-widest ${isActive('/boxes')}`}>Boxes</Link>
                    <Link to="/battle" className={`px-0.5 sm:px-1 py-1 sm:py-2 text-[10px] sm:text-xs font-bold uppercase border-b-2 transition-all tracking-tighter sm:tracking-widest ${isActive('/battle')}`}>Battles</Link>
                    <Link to="/games" className={`px-0.5 sm:px-1 py-1 sm:py-2 text-[10px] sm:text-xs font-bold uppercase border-b-2 transition-all tracking-tighter sm:tracking-widest ${isActive('/games')}`}>Games</Link>
                    <Link to="/rewards" className={`px-0.5 sm:px-1 py-1 sm:py-2 text-[10px] sm:text-xs font-bold uppercase border-b-2 transition-all tracking-tighter sm:tracking-widest ${isActive('/rewards')}`}>Rewards</Link>
                </div>

                {/* User Info / Auth - Right */}
                <div className="flex items-center justify-end gap-2 sm:gap-4 ml-2 sm:ml-4">
                    {user ? (
                        <div className="flex items-center gap-2 sm:gap-4">
                            {/* Balance Display - Now visible on all screens, adjusted for size */}
                            <div className="flex items-center gap-2 px-2 sm:px-3 py-1 bg-black/40 border border-[#2a2c45] rounded-md">
                                <span className="text-xs sm:text-sm font-bold text-white">{(balance || 0).toLocaleString()}</span>
                                <span className="text-[8px] sm:text-[10px] font-bold text-muted uppercase">GP</span>
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

            {showProfile && <UserProfileModal initialTab={profileTab} onClose={() => setShowProfile(false)} />}
        </>
    );
};
