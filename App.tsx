
import React, { createContext, useContext, useEffect, useState } from 'react';
import { MemoryRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './services/supabase';
import { GameService } from './services/gameService';
import { Navbar } from './components/Navbar';
import { Landing } from './pages/Landing';
import { Lobby } from './pages/Lobby';
import { SoloGame } from './pages/SoloGame';
import { Battle } from './pages/Battle';
import { BattleCreate } from './pages/BattleCreate';
import { BattleRoom } from './pages/BattleRoom';
import { BattleReplay } from './pages/BattleReplay';
import { Rewards } from './pages/Rewards';
import { AchievementGallery } from './pages/AchievementGallery';
import { EmailConfirmed } from './pages/EmailConfirmed';
import { OtherGames } from './pages/OtherGames';
import { CoinFlip } from './pages/CoinFlip';
import { Plinko } from './pages/Plinko';
import { Mines } from './pages/Mines';
import { Dice } from './pages/Dice';
import { Tower } from './pages/Tower';
import { Wheel } from './pages/Wheel';
import { Overload } from './pages/Overload';
import { Sigils } from './pages/Sigils';
import { ImageAudit } from './pages/ImageAudit';
import { AuthModal } from './components/AuthModal';

interface AuthContextType {
    user: any;
    balance: number;
    login: () => void;
    signup: () => void;
    logout: () => void;
    refreshBalance: (newVal?: number) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};

const AuthObserver: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    useEffect(() => {
        const handleAuth = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const hasHash = window.location.hash.includes('access_token');
            if (code || hasHash) {
                if (code) await supabase.auth.exchangeCodeForSession(code);
                if (location.pathname !== '/email-confirmed') navigate('/email-confirmed');
            }
        };
        handleAuth();
    }, [navigate, location]);
    return null;
};

export default function App() {
    const [user, setUser] = useState<any>(null);
    const [balance, setBalance] = useState(0);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

    const refreshBalance = async (newVal?: number) => {
        if (typeof newVal === 'number') { setBalance(newVal); return; }
        if (!user) return;
        try {
            const data = await GameService.getUserData(user.id);
            if (data) setBalance(data.balance);
        } catch (e) { console.error(e); }
    };

    const login = () => { setAuthMode('login'); setIsAuthModalOpen(true); };
    const signup = () => { setAuthMode('signup'); setIsAuthModalOpen(true); };
    const logout = async () => { await supabase.auth.signOut(); setUser(null); setBalance(0); };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => { if (user) refreshBalance(); }, [user]);

    return (
        <AuthContext.Provider value={{ user, balance, login, signup, logout, refreshBalance }}>
            <MemoryRouter initialEntries={['/']} initialIndex={0}>
                <AuthObserver />
                <div className="min-h-screen bg-bg text-white font-sans selection:bg-neon1 selection:text-black relative">
                    <Navbar />
                    <Routes>
                        <Route path="/" element={<Landing />} />
                        <Route path="/boxes" element={<Lobby />} />
                        <Route path="/game/:id" element={<SoloGame />} />
                        <Route path="/battle" element={<Battle />} />
                        <Route path="/battle/create" element={<BattleCreate />} />
                        <Route path="/battle/room/:id" element={<BattleRoom />} />
                        <Route path="/battle/replay/:id" element={<BattleReplay />} />
                        <Route path="/gallery" element={<AchievementGallery />} />
                        <Route path="/rewards" element={<Rewards />} />
                        <Route path="/games" element={<OtherGames />} />
                        <Route path="/games/coinflip" element={<CoinFlip />} />
                        <Route path="/games/plinko" element={<Plinko />} />
                        <Route path="/games/mines" element={<Mines />} />
                        <Route path="/games/dice" element={<Dice />} />
                        <Route path="/games/tower" element={<Tower />} />
                        <Route path="/games/wheel" element={<Wheel />} />
                        <Route path="/games/overload" element={<Overload />} />
                        <Route path="/games/sigils" element={<Sigils />} />
                        <Route path="/audit" element={<ImageAudit />} />
                        <Route path="/email-confirmed" element={<EmailConfirmed />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                    {isAuthModalOpen && !user && <AuthModal initialMode={authMode} onClose={() => setIsAuthModalOpen(false)} onSuccess={() => setIsAuthModalOpen(false)} />}
                </div>
            </MemoryRouter>
        </AuthContext.Provider>
    );
}
