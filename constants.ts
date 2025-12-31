
import { SUPABASE_URL } from './services/supabase';

export const normalizeItemImageName = (name: string): string => {
    if (!name) return '';
    // Remove special chars, replace spaces with underscores.
    // NOTE: We PRESERVE hyphens (-) as they are used in the filenames (e.g. Anti-Matter, Star-Forged).
    return name.trim()
        .replace(/['"’]/g, '')      // Remove apostrophes and quotes
        .replace(/[.,!]/g, '')      // Remove punctuation
        .replace(/[/\\]/g, '_')     // Replace slashes/backslashes with underscore (Sanitize path separators)
        .replace(/\s+/g, '_')       // Replace spaces with underscore
        .replace(/_+/g, '_')        // Collapse multiple underscores
        + '.png';
};

export const getBoxImageUrl = (path: string): string => {
    if (!path) return 'https://via.placeholder.com/150?text=No+Box';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${SUPABASE_URL}/storage/v1/object/public/box-images/${path}`;
};

export const getItemImageUrl = (path: string): string => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    // Updated bucket name from 'item-images' to 'item_images'
    return `${SUPABASE_URL}/storage/v1/object/public/item_images/${path}`;
};

export const GOLD_TEASE_ICON = '◆';

export const TIER_COLORS: Record<string, string> = {
    gray: '#8d8d8d',
    green: '#2ecc71',
    blue: '#3498db',
    red: '#ff5a54',
    gold: '#ffd700',
    neon: '#6df9ff',
    purple: '#a855f7',
    orange: '#f97316'
};

export const TIER_BG: Record<string, string> = {
    gray: 'bg-gray-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    gold: 'bg-yellow-400'
};

export const RULE_ICONS: Record<string, string> = {
    classic: '⚔️',
    terminal: '💣',
    less: '📉',
    whale: '🐳'
};

export const ITEM_ICONS: Record<string, string> = {};

export const BATTLE_EMOTES = [
    { id: 'gg', label: 'GG', icon: '🤝' },
    { id: 'gl', label: 'GL', icon: '🍀' },
    { id: 'nice', label: 'NICE', icon: '🔥' },
    { id: 'rip', label: 'RIP', icon: '💀' },
    { id: 'money', label: '$$$', icon: '🤑' },
    { id: 'salt', label: 'SALT', icon: '🧂' },
];

export const getItemIcon = (name: string): string => {
    // Return a placeholder image URL for unknown/default icons to avoid emojis
    // We assume components handle this string as a URL if it looks like one,
    // or we can return a transparent pixel data URI if we want to show 'nothing' until image loads.
    return 'https://via.placeholder.com/150?text='; 
};

let audioCtx: AudioContext | null = null;
let lastTickPlayTime = 0;
let lastTeasePlayTime = 0;
let lastWinPlayTime = 0;
let lastPlinkoBounceTime = 0;

const getAudioContext = () => {
    if (!audioCtx) {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
};

// --- SOUND HELPERS ---

export const playTickSound = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        // Strict global debounce: Only one tick per 45ms to avoid overlapping audio artifacts in multi-reels
        if (ctx.currentTime - lastTickPlayTime < 0.045) return;
        lastTickPlayTime = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
    } catch (e) {}
};

// COIN FLIP: White noise sweep (Shoosh)
export const playCoinFlipSound = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        
        const bufferSize = ctx.sampleRate * 1.5; // 1.5 seconds
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.5);
        filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 1.2);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.5);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
    } catch (e) {}
};

// PLINKO BOUNCE: Short woody/plastic tick
export const playPlinkoBounce = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.currentTime - lastPlinkoBounceTime < 0.05) return; // Debounce for multiple balls
        lastPlinkoBounceTime = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
    } catch (e) {}
};

// PLINKO LAND: Deeper thud
export const playPlinkoLand = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
        
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
};

// MINES/TOWER CLICK: Short high UI click
export const playMineClick = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1500, ctx.currentTime);
        
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.03);
    } catch (e) {}
};

// DIAMOND/LADDER: Magical Ting
export const playGemSound = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
};

// BOMB: Short Explosion
export const playBombSound = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        
        const bufferSize = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.4);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
    } catch (e) {}
};

// SKULL: Same as Bomb
export const playSkullSound = () => {
    playBombSound();
};

// DICE ROLL: Delayed Plastic Clatter (Optimized)
export const playDiceRollSound = (durationMs: number = 500) => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        
        // Start halfway through the animation to sync with the result "landing"
        const startDelay = (durationMs / 2) / 1000;
        const now = ctx.currentTime + startDelay;

        // Create one reusable noise buffer
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < bufferSize; j++) data[j] = Math.random() * 2 - 1;

        // Schedule 3 distinct 'clacks' to represent dice settling
        const impacts = [0, 0.08, 0.16];

        impacts.forEach((offset) => {
             const t = now + offset;
             
             const noise = ctx.createBufferSource();
             noise.buffer = buffer;
             
             const filter = ctx.createBiquadFilter();
             filter.type = 'highpass';
             filter.frequency.value = 1000;
             
             const filter2 = ctx.createBiquadFilter();
             filter2.type = 'lowpass';
             filter2.frequency.value = 2000;

             const gain = ctx.createGain();
             // First hit harder, subsequent hits softer
             const volume = offset === 0 ? 0.35 : 0.2;
             gain.gain.setValueAtTime(volume, t);
             gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
             
             noise.connect(filter);
             filter.connect(filter2);
             filter2.connect(gain);
             gain.connect(ctx.destination);
             
             noise.start(t);
        });
    } catch (e) {}
};

export const playGoldTeaseSound = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        // Legendary tease debounce: Only one magical "sweep" per 800ms
        if (ctx.currentTime - lastTeasePlayTime < 0.8) return;
        lastTeasePlayTime = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.5);
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 15;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 500;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.4);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
        lfo.stop(ctx.currentTime + 0.6);
    } catch (e) {}
}

export const playWinSound = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        // Win sound debounce: Only one fanfare per 400ms
        if (ctx.currentTime - lastWinPlayTime < 0.4) return;
        lastWinPlayTime = ctx.currentTime;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 1.0);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        osc.start();
        osc.stop(ctx.currentTime + 1.5);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(800, ctx.currentTime);
        osc2.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.5);
        gain2.gain.setValueAtTime(0.05, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.5);
    } catch (e) {}
};
