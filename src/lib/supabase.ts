import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const configured = Boolean(url && key && !url.includes("YOUR_PROJECT"));

// Captured before supabase-js clears the URL hash, so we can tell invite / recovery links apart.
export const initialAuthHash = typeof window !== "undefined" ? window.location.hash : "";
export const arrivedViaInvite = /type=(invite|recovery|signup)/.test(initialAuthHash);

export const supabase = createClient(url || "https://placeholder.supabase.co", key || "placeholder-anon-key", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
