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

export const SUPABASE_URL = 'https://haxegedltxvyfqtqaxhn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KAc5c3VnRGltpsEuTEVPWw_XTZeNdvw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: safeLocalStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true // Re-enabled to catch OAuth tokens from Google redirect
  }
});