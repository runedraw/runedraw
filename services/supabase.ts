import { createClient } from '@supabase/supabase-js';

// Safe storage implementation that tries LocalStorage but falls back to memory
// This ensures persistence works for Google Login, but doesn't crash in restricted iframes.
const safeLocalStorage = (() => {
  let memoryStore: Record<string, string> = {};
  return {
    getItem: (key: string) => {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return memoryStore[key] || null;
      }
    },
    setItem: (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        memoryStore[key] = value;
      }
    },
    removeItem: (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        delete memoryStore[key];
      }
    }
  };
})();

// Defaults from project configuration (Fallbacks)
const FALLBACK_URL = 'https://haxegedltxvyfqtqaxhn.supabase.co';
// Note: This key format is non-standard for Supabase (usually JWT starting with ey...), 
// but we use the provided context to prevent crashes.
const FALLBACK_KEY = 'sb_publishable_KAc5c3VnRGltpsEuTEVPWw_XTZeNdvw';

// Helper to retrieve environment variables safely with fallbacks
const getEnv = (key: string, fallback: string) => {
    try {
        // @ts-ignore - Handle case where import.meta.env is undefined
        const envVal = (import.meta && import.meta.env) ? import.meta.env[key] : undefined;
        return envVal || fallback;
    } catch (e) {
        return fallback;
    }
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL', FALLBACK_URL);
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY', FALLBACK_KEY);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Critical: Supabase credentials missing.");
}

export { SUPABASE_URL };

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: safeLocalStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true // Re-enabled to catch OAuth tokens from Google redirect
  }
});