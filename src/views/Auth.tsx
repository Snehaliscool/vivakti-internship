import { useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, ArrowUpRight, Eye, EyeOff, KeyRound, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Brand } from "../components/ui";
import { supabase, configured } from "../lib/supabase";

export function Login({ onDemo }: { onDemo?: (role: "admin" | "member" | "intern") => void }) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [info, setInfo] = useState("");
  const [mode, setMode] = useState<"in" | "reset">("in");

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setInfo("");
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(error.message === "Invalid login credentials" ? "That email and password don't match. Check them and try again." : error.message);
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      if (error) setError(error.message); else setInfo("If that email is registered, a reset link is on its way.");
    }
    setBusy(false);
  }
  return <div className="auth-wrap"><div className="auth-card">
    <Brand centered />
    <div className="eyebrow">{mode === "in" ? "TEAM ACCESS" : "RESET PASSWORD"}</div>
    <h1>{mode === "in" ? "Welcome back." : "Forgot your password?"}</h1>
    <p className="muted">{mode === "in" ? "Sign in to continue to your internship workspace." : "Enter your email and we'll send a link to choose a new one."}</p>
    {configured ? <form onSubmit={submit} className="form">
      <label>Email address<div className="field"><Mail size={16} /><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus /></div></label>
      {mode === "in" && <label>Password<div className="field"><KeyRound size={16} />
        <input type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required />
        <button type="button" className="eye" onClick={() => setShow(s => !s)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>}
      {error && <div className="error" role="alert"><AlertCircle size={15} />{error}</div>}
      {info && <div className="okmsg" role="status">{info}</div>}
      <button className="btn primary full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Send reset link"}<ArrowUpRight size={16} /></button>
      <button type="button" className="text-btn center-btn" onClick={() => { setMode(mode === "in" ? "reset" : "in"); setError(""); setInfo(""); }}>{mode === "in" ? "Forgot password?" : "Back to sign in"}</button>
    </form> : <div className="demo-box">
      <div className="invite-note"><Sparkles size={17} />Supabase isn't connected yet, so you're seeing the built-in demo. Nothing here leaves your browser.</div>
      <button className="btn primary full" onClick={() => onDemo?.("admin")}>Explore as administrator<ArrowUpRight size={16} /></button>
      <button className="btn secondary full" onClick={() => onDemo?.("member")}>Explore as member<ArrowUpRight size={16} /></button>
      <button className="btn secondary full" onClick={() => onDemo?.("intern")}>Explore as intern<ArrowUpRight size={16} /></button>
      <p className="muted small-print">To go live, add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see README).</p>
    </div>}
    <div className="auth-foot"><ShieldCheck size={15} /> Invite-only access · Your work stays within Vivakti</div>
  </div><div className="auth-caption">A better way to learn by doing.</div></div>;
}

export function SetPassword({ done }: { done: () => void }) {
  const [p1, setP1] = useState(""), [p2, setP2] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    if (p1.length < 8) return setError("Use at least 8 characters.");
    if (p1 !== p2) return setError("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) setError(error.message); else done();
  }
  return <div className="auth-wrap"><div className="auth-card">
    <Brand centered /><div className="eyebrow">ONE LAST STEP</div><h1>Choose a password.</h1>
    <p className="muted">You'll use it with your email to sign in next time.</p>
    <form className="form" onSubmit={submit}>
      <label>New password<div className="field"><KeyRound size={16} /><input type="password" autoComplete="new-password" value={p1} onChange={e => setP1(e.target.value)} minLength={8} required autoFocus /></div></label>
      <label>Confirm password<div className="field"><KeyRound size={16} /><input type="password" autoComplete="new-password" value={p2} onChange={e => setP2(e.target.value)} minLength={8} required /></div></label>
      {error && <div className="error" role="alert"><AlertCircle size={15} />{error}</div>}
      <button className="btn primary full" disabled={busy}>{busy ? "Saving…" : "Save and continue"}<ArrowUpRight size={16} /></button>
    </form></div></div>;
}
