// Deploy with: supabase functions deploy create-intern
// Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as Edge Function secrets.
// The service-role key must never be shipped to the browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({error:"Method not allowed"}), {status:405,headers:{...cors,"Content-Type":"application/json"}});
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") || "";
  const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return new Response(JSON.stringify({error:"Unauthorized"}), {status:401,headers:{...cors,"Content-Type":"application/json"}});
  const admin = createClient(url, serviceKey);
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response(JSON.stringify({error:"Admin access required"}), {status:403,headers:{...cors,"Content-Type":"application/json"}});
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const full_name = String(body.full_name || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !full_name) return new Response(JSON.stringify({error:"Valid email and full name are required"}), {status:400,headers:{...cors,"Content-Type":"application/json"}});
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name } });
  if (error) return new Response(JSON.stringify({error:error.message}), {status:400,headers:{...cors,"Content-Type":"application/json"}});
  return new Response(JSON.stringify({ok:true}), {status:200,headers:{...cors,"Content-Type":"application/json"}});
});
