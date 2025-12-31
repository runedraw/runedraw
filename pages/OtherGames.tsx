
import React from 'react';
import { useNavigate } from 'react-router-dom';

export const OtherGames: React.FC = () => {
    const navigate = useNavigate();

    const games = [
        {
            id: 'coinflip',
            name: 'Coin Flip',
            desc: '50/50. Double or nothing. The classic wager.',
            icon: '🪙',
            color: 'text-yellow-400',
            borderColor: 'hover:border-yellow-400'
        },
        {
            id: 'overload',
            name: 'Overload',
            desc: 'Reactor critical. Eject before the system crashes.',
            icon: '☢️',
            color: 'text-orange-500',
            borderColor: 'hover:border-orange-500'
        },
        {
            id: 'plinko',
            name: 'Plinko',
            desc: 'Drop the rune and watch it bounce to high multipliers.',
            icon: '📉',
            color: 'text-pink-400',
            borderColor: 'hover:border-pink-400'
        },
        {
            id: 'mines',
            name: 'Mines',
            desc: 'Navigate the grid. Avoid the data breaches to multiply your win.',
            icon: '💣',
            color: 'text-red-500',
            borderColor: 'hover:border-red-500'
        },
        {
            id: 'sigils',
            name: 'Sigils',
            desc: 'Select your runes. Match the drawn sigils for divine rewards.',
            icon: '🔮',
            color: 'text-cyan-400',
            borderColor: 'hover:border-cyan-400'
        },
        {
            id: 'dice',
            name: 'Dice',
            desc: 'Set your win chance. Roll under the target to win.',
            icon: '🎲',
            color: 'text-green-400',
            borderColor: 'hover:border-green-400'
        },
        {
            id: 'tower',
            name: 'Tower',
            desc: 'Climb the tower for massive gains. Don\'t fall.',
            icon: '🪜',
            color: 'text-blue-400',
            borderColor: 'hover:border-blue-400'
        },
        {
            id: 'wheel',
            name: 'Wheel',
            desc: 'Spin for multipliers. Simple and elegant.',
            icon: '🎡',
            color: 'text-purple-400',
            borderColor: 'hover:border-purple-400'
        }
    ];

    return (
        <div className="container mx-auto p-4 max-w-7xl min-h-[85vh]">
            <div className="text-center mb-10 mt-6">
                <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-2">Arcade Sector</h1>
                <p className="text-muted text-sm font-bold uppercase tracking-widest">High risk, instant reward mini-games</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {games.map(game => (
                    <div 
                        key={game.id}
                        onClick={() => navigate(`/games/${game.id}`)}
                        className={`group bg-[#0e1020] border border-[#2a2c45] rounded-3xl p-6 cursor-pointer ${game.borderColor} hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-300 relative overflow-hidden`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="flex justify-between items-start mb-8">
                            <div className="w-12 h-12 bg-[#1a1d2e] rounded-xl flex items-center justify-center text-3xl shadow-inner border border-white/5 group-hover:scale-110 transition-transform">
                                {game.icon}
                            </div>
                        </div>

                        <h2 className={`text-2xl font-black uppercase tracking-wider mb-2 ${game.color}`}>{game.name}</h2>
                        <p className="text-gray-400 text-xs leading-relaxed mb-6">
                            {game.desc}
                        </p>

                        <button className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold uppercase text-xs rounded-xl group-hover:bg-white group-hover:text-black transition-all">
                            Play Now
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
